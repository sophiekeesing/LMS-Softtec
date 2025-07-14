import { updateLoadingStep } from "@/stores/loading";

// Polyline decoder adapted from Valhalla official documentation
// https://github.com/DennisOSRM/Project-OSRM-Web/blob/master/WebContent/routing/OSRM.RoutingGeometry.js
class PolylineDecoder {
    static decode(str: string, precision?: number): [number, number][] {
        var index = 0,
            lat = 0,
            lng = 0,
            coordinates: [number, number][] = [],
            shift = 0,
            result = 0,
            byte = null,
            latitude_change,
            longitude_change,
            factor = Math.pow(10, precision || 6);

        // Coordinates have variable length when encoded, so just keep
        // track of whether we've hit the end of the string. In each
        // loop iteration, a single coordinate is decoded.
        while (index < str.length) {
            // Reset shift, result, and byte
            byte = null;
            shift = 0;
            result = 0;

            do {
                byte = str.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);

            latitude_change = result & 1 ? ~(result >> 1) : result >> 1;

            shift = result = 0;

            do {
                byte = str.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);

            longitude_change = result & 1 ? ~(result >> 1) : result >> 1;

            lat += latitude_change;
            lng += longitude_change;

            coordinates.push([lat / factor, lng / factor]);
        }

        return coordinates;
    }
}

export interface RoutePoint {
    lat: number;
    lng: number;
}

export interface CalculatedRoute {
    waypoints: [number, number][];
    distance: number; // in meters
    duration: number; // in seconds
}

// Routing service using Valhalla routing engine
export class RoutingService {
    private static instance: RoutingService;
    private readonly valhallaBaseUrl = "https://valhalla1.openstreetmap.de/route";

    private constructor() {}

    public static getInstance(): RoutingService {
        if (!RoutingService.instance) {
            RoutingService.instance = new RoutingService();
        }
        return RoutingService.instance;
    }

    /**
     * Calculate route between two points using Valhalla routing engine
     */
    public async calculateRoute(start: [number, number], end: [number, number]): Promise<CalculatedRoute> {
        try {
            console.log(`Calculating route from ${start} to ${end} using Valhalla`);

            const requestBody = {
                locations: [
                    { lat: start[0], lon: start[1] },
                    { lat: end[0], lon: end[1] },
                ],
                costing: "bicycle", // Use bicycle costing for scooters
                costing_options: {
                    bicycle: {
                        bicycle_type: "Road",
                        cycling_speed: 15, // km/h - typical scooter speed
                        use_roads: 0.5, // Prefer bike lanes but allow roads
                        use_hills: 0.2, // Avoid steep hills
                    },
                },
                shape_match: "edge_walk",
                units: "kilometers",
            };

            const response = await fetch(this.valhallaBaseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`Valhalla API error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.trip || !data.trip.legs || data.trip.legs.length === 0) {
                throw new Error("No route found in Valhalla response");
            }

            const leg = data.trip.legs[0];
            const waypoints: [number, number][] = [];

            // Extract shape points from the response
            if (leg.shape) {
                console.log("Decoding polyline shape using Valhalla decoder:", leg.shape.substring(0, 50) + "...");
                try {
                    // Use official Valhalla polyline decoder
                    const decodedCoords = PolylineDecoder.decode(leg.shape);
                    console.log("Decoded shape points (first 3):", decodedCoords.slice(0, 3));
                    waypoints.push(...decodedCoords);
                } catch (polylineError) {
                    console.error("Polyline decoding failed:", polylineError);
                    // Fallback to start/end points if polyline decoding fails
                    waypoints.push(start, end);
                }
            } else {
                console.log("No shape available, using maneuvers");
                // Fallback to maneuver points if shape is not available
                leg.maneuvers?.forEach((maneuver: any) => {
                    if (maneuver.begin_shape_index !== undefined) {
                        console.log("Adding maneuver point:", [maneuver.lat, maneuver.lon]);
                        waypoints.push([maneuver.lat, maneuver.lon]);
                    }
                });
            }

            // If no waypoints extracted, use start and end points
            if (waypoints.length === 0) {
                console.log("No waypoints found, using start/end points");
                waypoints.push(start, end);
            }

            // Validate waypoints are within reasonable bounds for our area (Hamburg north of Elbe + surrounding)
            const validWaypoints = waypoints.filter((point) => {
                const [lat, lng] = point;
                // More generous bounds for Hamburg area (north of Elbe)
                const isValid = lat >= 53.5 && lat <= 53.7 && lng >= 9.8 && lng <= 10.2;
                if (!isValid) {
                    console.warn("Waypoint outside Hamburg area (north of Elbe):", point);
                }
                return isValid;
            });

            if (validWaypoints.length === 0) {
                console.error("All waypoints are invalid, using fallback");
                throw new Error("All waypoints invalid");
            }

            const result = {
                waypoints: validWaypoints,
                distance: leg.summary.length * 1000, // Convert km to meters
                duration: leg.summary.time, // Already in seconds
            };

            console.log(`Valhalla route calculated: ${result.distance}m, ${result.duration}s, ${validWaypoints.length} waypoints`);
            console.log("First waypoint:", validWaypoints[0], "Last waypoint:", validWaypoints[validWaypoints.length - 1]);
            return result;
        } catch (error) {
            console.warn("Valhalla routing failed, using direct route:", error);
            return this.createDirectRoute(start, end);
        }
    }

    /**
     * Create a direct route as fallback
     */
    private createDirectRoute(start: [number, number], end: [number, number]): CalculatedRoute {
        const distance = this.calculateDistance(start, end);
        const averageSpeed = 15; // km/h
        const duration = (distance / 1000 / averageSpeed) * 3600; // seconds

        return {
            waypoints: [start, end],
            distance,
            duration,
        };
    }

    /**
     * Calculate distance between two points (Haversine formula)
     */
    private calculateDistance(pos1: [number, number], pos2: [number, number]): number {
        const R = 6371000; // Earth's radius in meters
        const φ1 = (pos1[0] * Math.PI) / 180;
        const φ2 = (pos2[0] * Math.PI) / 180;
        const Δφ = ((pos2[0] - pos1[0]) * Math.PI) / 180;
        const Δλ = ((pos2[1] - pos1[1]) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Interpolate position along route waypoints
     */
    public interpolatePosition(waypoints: [number, number][], progress: number): [number, number] {
        if (!waypoints || waypoints.length < 2) {
            console.warn("Invalid waypoints for interpolation:", waypoints);
            return waypoints?.[0] || [0, 0];
        }

        if (progress <= 0) return waypoints[0];
        if (progress >= 1) return waypoints[waypoints.length - 1];

        // Calculate total distance
        let totalDistance = 0;
        const segments: { start: [number, number]; end: [number, number]; distance: number }[] = [];

        for (let i = 0; i < waypoints.length - 1; i++) {
            const distance = this.calculateDistance(waypoints[i], waypoints[i + 1]);
            segments.push({
                start: waypoints[i],
                end: waypoints[i + 1],
                distance,
            });
            totalDistance += distance;
        }

        if (totalDistance === 0) {
            console.warn("Total distance is 0, returning first waypoint");
            return waypoints[0];
        }

        // Find target distance
        const targetDistance = totalDistance * progress;
        let accumulatedDistance = 0;

        // Find the segment containing the target position
        for (const segment of segments) {
            if (accumulatedDistance + segment.distance >= targetDistance) {
                const segmentProgress = (targetDistance - accumulatedDistance) / segment.distance;
                const [startLat, startLng] = segment.start;
                const [endLat, endLng] = segment.end;

                const interpolatedPosition: [number, number] = [
                    startLat + (endLat - startLat) * segmentProgress,
                    startLng + (endLng - startLng) * segmentProgress,
                ];

                // Validate the interpolated position
                if (isNaN(interpolatedPosition[0]) || isNaN(interpolatedPosition[1])) {
                    console.error("Invalid interpolated position:", interpolatedPosition, "from segment:", segment, "progress:", segmentProgress);
                    return waypoints[0];
                }

                return interpolatedPosition;
            }
            accumulatedDistance += segment.distance;
        }

        // Fallback to last waypoint
        return waypoints[waypoints.length - 1];
    }

    /**
     * Check if a position is accessible (on roads/paths) using a very short route calculation
     */
    public async isPositionAccessible(position: [number, number]): Promise<boolean> {
        try {
            console.log(`Checking accessibility for position ${position} using Valhalla route`);

            // Create a very short route (1 meter) to test if position is on a road
            const offset = 0.00001; // About 1 meter
            const endPosition: [number, number] = [position[0] + offset, position[1] + offset];

            const requestBody = {
                locations: [
                    { lat: position[0], lon: position[1] },
                    { lat: endPosition[0], lon: endPosition[1] },
                ],
                costing: "bicycle", // Use bicycle costing for scooters
                directions_options: {
                    units: "kilometers",
                },
                filters: {
                    attributes: ["edge.road_class"],
                    action: "include",
                },
            };

            const response = await fetch("https://valhalla1.openstreetmap.de/route", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                console.warn(`Valhalla accessibility check failed: ${response.status} ${response.statusText}`);
                return false; // If API fails, consider position inaccessible to be safe
            }

            const data = await response.json();

            // Check if we got a valid route
            if (!data.trip || !data.trip.legs || data.trip.legs.length === 0) {
                console.log(`Position ${position} could not be routed - likely in water or inaccessible area`);
                return false;
            }

            // If we can calculate a route, the position is accessible
            console.log(`Position ${position} is accessible`);
            return true;
        } catch (error) {
            console.error("Error checking position accessibility:", error);
            return false; // If there's an error, consider position inaccessible to be safe
        }
    }

    /**
     * Generate a valid position by trying random coordinates until one is accessible
     */
    public async generateValidPosition(
        bounds: { north: number; south: number; east: number; west: number },
        maxAttempts: number = 10,
    ): Promise<[number, number] | null> {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const lat = bounds.south + Math.random() * (bounds.north - bounds.south);
            const lng = bounds.west + Math.random() * (bounds.east - bounds.west);
            const position: [number, number] = [lat, lng];

            // Update loading progress if validation step is active
            try {
                updateLoadingStep("validation", "loading", `Versuch ${attempt + 1}/${maxAttempts}: Position wird geprüft...`);
            } catch {
                // Loading step might not exist, ignore error
            }

            const isAccessible = await this.isPositionAccessible(position);
            if (isAccessible) {
                console.log(`Found valid position after ${attempt + 1} attempts: ${position}`);
                return position;
            }
        }

        console.warn(`Could not find valid position after ${maxAttempts} attempts`);
        return null;
    }
}

export const routingService = RoutingService.getInstance();
