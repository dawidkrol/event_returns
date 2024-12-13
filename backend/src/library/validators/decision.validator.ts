import { Decision } from "~/models/decision.model";
import { WithError } from "~/utils/utils.type";

export function validateDecision(decision: string): WithError<{ decisionModel: Decision }, string> {
    if (!decision) {
        return { error: "Missing required fields" };
    }

    if (decision !== "accept" && decision !== "reject") {
        return { error: "Invalid decision" };
    }

    return {
        decisionModel: decision as Decision
    };
}
