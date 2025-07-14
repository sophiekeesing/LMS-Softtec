import { ref } from "vue";

export interface LoadingStep {
    id: string;
    label: string;
    detail?: string;
    status: "pending" | "loading" | "completed" | "error";
}

export interface LoadingState {
    isLoading: boolean;
    currentTask: string;
    progress: number; // 0-100
    progressText: string;
    steps: LoadingStep[];
    errorMessage?: string;
}

// Global loading state
export const loadingState = ref<LoadingState>({
    isLoading: false,
    currentTask: "",
    progress: 0,
    progressText: "",
    steps: [],
    errorMessage: undefined,
});

// Loading state management functions
export function startLoading(task: string, steps: LoadingStep[]) {
    loadingState.value = {
        isLoading: true,
        currentTask: task,
        progress: 0,
        progressText: "Wird gestartet...",
        steps: steps.map((step) => ({ ...step, status: "pending" })),
        errorMessage: undefined,
    };
}

export function updateLoadingStep(stepId: string, status: LoadingStep["status"], detail?: string) {
    const step = loadingState.value.steps.find((s) => s.id === stepId);
    if (step) {
        step.status = status;
        if (detail) {
            step.detail = detail;
        }
    }

    // Update overall progress based on completed steps
    const totalSteps = loadingState.value.steps.length;
    const completedSteps = loadingState.value.steps.filter((s) => s.status === "completed").length;
    loadingState.value.progress = Math.round((completedSteps / totalSteps) * 100);

    // Update progress text
    if (status === "loading") {
        loadingState.value.progressText = `${step?.label}...`;
    } else if (status === "completed") {
        const remaining = totalSteps - completedSteps - 1;
        if (remaining > 0) {
            loadingState.value.progressText = `${completedSteps + 1} von ${totalSteps} abgeschlossen`;
        } else {
            loadingState.value.progressText = "Wird abgeschlossen...";
        }
    }
}

export function setLoadingProgress(progress: number, text?: string) {
    loadingState.value.progress = Math.min(100, Math.max(0, progress));
    if (text) {
        loadingState.value.progressText = text;
    }
}

export function setLoadingError(error: string) {
    loadingState.value.errorMessage = error;
}

export function finishLoading() {
    // Mark all steps as completed
    loadingState.value.steps.forEach((step) => {
        if (step.status === "loading" || step.status === "pending") {
            step.status = "completed";
        }
    });

    loadingState.value.progress = 100;
    loadingState.value.progressText = "Abgeschlossen!";

    // Hide loading panel after a short delay
    setTimeout(() => {
        loadingState.value.isLoading = false;
    }, 500);
}

export function cancelLoading() {
    loadingState.value.isLoading = false;
    loadingState.value.errorMessage = undefined;
}

// Convenience functions for common loading scenarios
export function startScooterLoading(scooterCount: number) {
    const steps: LoadingStep[] = [
        { id: "init", label: "Initialisierung", status: "pending" },
        { id: "scooters", label: `${scooterCount} E-Scooter generieren`, status: "pending" },
        { id: "validation", label: "Smart Positioning", status: "pending" },
        { id: "rides", label: "Aktive Fahrten erstellen", status: "pending" },
        { id: "routes", label: "Direkte Routen berechnen", status: "pending" },
        { id: "finalize", label: "Abschließen", status: "pending" },
    ];

    startLoading("E-Scooter Daten werden geladen", steps);
}

export function startRouteCalculation() {
    const steps: LoadingStep[] = [
        { id: "request", label: "Route anfordern", status: "pending" },
        { id: "calculate", label: "Route berechnen", status: "pending" },
        { id: "optimize", label: "Route optimieren", status: "pending" },
        { id: "complete", label: "Route fertigstellen", status: "pending" },
    ];

    startLoading("Route wird berechnet", steps);
}
