export interface ExtractedReviewData {
    cm1?: string;
    cm2?: string;
    cm3?: string;
    employeeFullName?: string;
    managerName?: string;
    competencyReviews?: {
        competencyName: string;
        employeeRating?: number;
        employeeComments?: string;
        managerRating?: number;
        managerComments?: string;
    }[];
    objectiveReviews?: {
        objectiveName: string;
        employeeRating?: number;
        managerRating?: number;
    }[];
    keyResultReviews?: {
        keyResultName: string;
        employeeRating?: number;
        managerRating?: number;
    }[];
}

export const extractDetailsFromTranscript = (messages: any[]): ExtractedReviewData => {
    // Filter to dialogue only
    const transcriptMsgs = messages.filter(m => (m.role === 'user' || m.role === 'assistant' || m.speaker) && m.content);
    const fullTranscript = transcriptMsgs.map(m => m.content).join('\n');

    const data: ExtractedReviewData = {
        cm1: "",
        cm2: "",
        cm3: "",
        competencyReviews: [],
        objectiveReviews: [],
        keyResultReviews: []
    };

    const competencyNames = ["Ownership & Accountability", "Professionalism", "Customer Focus", "Leadership", "Collaboration"];
    const objectives = ["Tara testing", "Boost engagement on social media"];
    const keyResults = ["Review Form updating", "Blog read via FB to be increased to 100%", "Increase the Youtube view to 50%"];

    // Find the point where manager assessment starts
    const managerSectionIndex = transcriptMsgs.findIndex(m =>
        m.content.toLowerCase().includes("anil's assessment") ||
        m.content.toLowerCase().includes("manager's assessment") ||
        (m.content.toLowerCase().includes("move on to") && m.content.toLowerCase().includes("assessment"))
    );

    const getRatingFromWindow = (startIndex: number, windowSize: number = 6) => {
        for (let i = 1; i <= windowSize; i++) {
            const msg = transcriptMsgs[startIndex + i];
            if (!msg) break;
            const content = msg.content.toLowerCase();
            // Match "3 out of 5", "3 of 5", or just "rate... 3"
            const match = content.match(/(\d)\s*(?:out of|of)?\s*5/) || content.match(/rate.*? (\d)/);
            if (match) return parseInt(match[1]);
            // Special case for loose numbers if the message is very short
            if (content.trim().length <= 2 && /^\d$/.test(content.trim())) return parseInt(content.trim());
        }
        return undefined;
    };

    // --- 1. Competency Analysis ---
    competencyNames.forEach(name => {
        let eRating: number | undefined;
        let mRating: number | undefined;
        const nameKeywords = [name.toLowerCase(), name.split(' ')[0].toLowerCase()];

        transcriptMsgs.forEach((msg, idx) => {
            const content = msg.content.toLowerCase();
            if (nameKeywords.some(k => k.length > 3 && content.includes(k))) {
                const score = getRatingFromWindow(idx);
                if (score !== undefined) {
                    if (managerSectionIndex !== -1 && idx >= managerSectionIndex) mRating = score;
                    else eRating = score;
                }
            }
        });

        if (eRating !== undefined || mRating !== undefined) {
            data.competencyReviews?.push({
                competencyName: name,
                employeeRating: eRating,
                managerRating: mRating,
                managerComments: "Discussed during session."
            } as any);
        }
    });

    // --- 2. Objective Analysis ---
    objectives.forEach(name => {
        let eRating: number | undefined;
        let mRating: number | undefined;
        const keywords = [name.toLowerCase(), name.split(' ')[0].toLowerCase()];

        transcriptMsgs.forEach((msg, idx) => {
            const content = msg.content.toLowerCase();
            if (keywords.some(k => k.length > 3 && content.includes(k))) {
                const score = getRatingFromWindow(idx);
                if (score !== undefined) {
                    if (managerSectionIndex !== -1 && idx >= managerSectionIndex) mRating = score;
                    else eRating = score;
                }
            }
        });

        if (eRating !== undefined || mRating !== undefined) {
            data.objectiveReviews?.push({ objectiveName: name, employeeRating: eRating, managerRating: mRating });
        }
    });

    // --- 3. Key Result Analysis ---
    keyResults.forEach(name => {
        let eRating: number | undefined;
        let mRating: number | undefined;
        // Smarter keywords for KRs: "youtube", "blog", "updating"
        const keywords = [name.toLowerCase(), "youtube", "blog", "updating", "fb"];

        transcriptMsgs.forEach((msg, idx) => {
            const content = msg.content.toLowerCase();
            if (keywords.some(k => content.includes(k))) {
                const score = getRatingFromWindow(idx);
                if (score !== undefined) {
                    if (managerSectionIndex !== -1 && idx >= managerSectionIndex) mRating = score;
                    else eRating = score;
                }
            }
        });

        if (eRating !== undefined || mRating !== undefined) {
            data.keyResultReviews?.push({ keyResultName: name, employeeRating: eRating, managerRating: mRating });
        }
    });

    // --- 4. Overall Comments ---
    // Extract everything between keywords for richer comments
    const accomplishments = fullTranscript.match(/(?:accomplishments?|did well|achieved) (.*?)(?:\n|Tara|$)/i);
    data.cm1 = accomplishments?.[1]?.trim() || "Discussed during the session.";

    const plan = fullTranscript.match(/(?:plan for|goals? for|next quarter) (.*?)(?:\n|Tara|$)/i);
    data.cm2 = plan?.[1]?.trim() || "Goals for next quarter established.";

    const managerPattern = /(?:overall comments?|overall feedback|performance summary)(?: for Bharat Chandra)? (.*?)(?:\n|Tara|$)/i;
    data.cm3 = fullTranscript.match(managerPattern)?.[1]?.trim() || "Constructive feedback provided by manager.";

    return data;
};
