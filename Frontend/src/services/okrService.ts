export interface KeyResult {
    id: string;
    description: string;
    target: string;
    current: string;
    metrics: string;
    _id?: string;
    keyResultName?: string;
    targetValue?: string | number;
    actual?: string | number;
    unit?: string;
}

export interface OKR {
    id: string;
    objective: string;
    keyResults: KeyResult[];
    _id?: string;
    progressStatus?: number;
    progress?: number;
    children?: any[];
}

export interface ReviewQuestion {
    id: string;
    text: string;
    category: string;
    subCategory?: string;
}

export interface Competency {
    id: string;
    name: string;
    description?: string;
    questions?: ReviewQuestion[];
}

// Utility for string normalization
const normalizeString = (s: string) => (s || "").toLowerCase().trim().replace(/&/g, 'and').replace(/\s+/g, ' ');

// Cache to store the full KR objects so we can send complete payloads on update
let okrCache: any[] = [];

// Helper to replace placeholders
const replaceUrlPlaceholders = (url: string, employeeId?: string, managerId?: string) => {
    let newUrl = url;
    if (employeeId) {
        newUrl = newUrl.replace(/\{emp_id\}/g, employeeId)
            .replace(/\{userId\}/g, employeeId); // Common placeholder variant
    }
    if (managerId) {
        newUrl = newUrl.replace(/\{mgr_id\}/g, managerId);
    }
    return newUrl;
};

export const fetchEmployeeOKRs = async (employeeId?: string, managerId?: string): Promise<OKR[]> => {
    const apiKey = import.meta.env.VITE_EMPLOYEE_API_KEY;
    let apiUrl = import.meta.env.VITE_OKR_API_URL;

    if (employeeId && apiUrl) {
        // First try placeholder replacement
        if (apiUrl.includes('{emp_id}') || apiUrl.includes('{userId}')) {
            apiUrl = replaceUrlPlaceholders(apiUrl, employeeId, managerId);
        } else {
            // Fallback to query param injection if no placeholders found (Old logic)
            const urlObj = new URL(apiUrl);
            urlObj.searchParams.set('userId', employeeId);
            urlObj.searchParams.set('empId', employeeId);
            apiUrl = urlObj.toString();
        }
    }

    if (!apiKey || !apiUrl) {
        console.warn('OKR API key or URL is missing. Returning empty OKRs.');
        return [];
    }

    try {
        // Safety Check: Do not fetch if placeholders remain
        if (apiUrl.includes('{emp_id}') || apiUrl.includes('{mgr_id}') || apiUrl.includes('{userId}')) {
            console.warn("Aborting OKR fetch: URL contains unresolved placeholders. Missing Employee ID?", apiUrl);
            return []; // Return empty to allow synthetic fallback logic or graceful fail
        }

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch OKRs: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Fetched OKR Data:', JSON.stringify(data, null, 2));

        // Handle different potential response structures
        let objectivesList: any[] = [];
        if (Array.isArray(data)) {
            objectivesList = data;
        } else if (data && Array.isArray(data.data)) {
            objectivesList = data.data;
        } else if (data && Array.isArray(data.objectives)) {
            objectivesList = data.objectives;
        } else {
            console.warn('Could not find an array of objectives in the response:', data);
            return [];
        }

        // Update Cache
        okrCache = objectivesList;

        // Map to internal OKR interface with fallbacks for field names
        // The API returns key results in the 'children' array
        return objectivesList.map((item: any) => ({
            id: item._id || item.id || 'unknown-id',
            objective: item.objective || item.title || item.name || item.description || 'No Objective Title',
            keyResults: (item.children || item.keyResults || item.key_results || []).map((kr: any) => ({
                id: kr._id || kr.krID || kr.id || 'unknown-kr-id',
                description: kr.keyResultName || kr.okrName || kr.description || kr.title || kr.name || 'No KR Description',
                target: String(kr.target || kr.targetValue || '0'),
                current: String(kr.actual || kr.current || kr.currentValue || '0'),
                metrics: kr.unit || kr.uom || kr.metrics || ''
            }))
        }));
    } catch (error) {
        console.error('Error fetching OKRs:', error);
        return [];
    }
};

export const fetchReviewForm = async (employeeId?: string, managerId?: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_EMPLOYEE_API_KEY;
    let apiUrl = import.meta.env.VITE_REVIEW_FORM_API_URL;

    // Dynamic URL Construction
    if (apiUrl) {
        if (employeeId || managerId) {
            // 1. Try Placeholder Replacement
            if (apiUrl.includes('{emp_id}') || apiUrl.includes('{mgr_id}')) {
                apiUrl = replaceUrlPlaceholders(apiUrl, employeeId, managerId);
            }
            // 2. Fallback to path logic if no placeholders
            else if (employeeId) {
                // Expected Env Format: .../getAllReviewsForm/<CompId>/<EmpId>/Employee?companyId=...
                const parts = apiUrl.split('/');
                const index = parts.findIndex(p => p.includes('getAllReviewsForm'));
                if (index !== -1 && parts.length > index + 2) {
                    parts[index + 2] = employeeId;
                    apiUrl = parts.join('/');
                } else {
                    console.warn("Could not handle dynamic URL replacement for Review Form. Using default.");
                }
            }
        }
    }

    if (!apiKey || !apiUrl) {
        console.warn('Review API key or URL is missing.');
        return null;
    }

    try {
        let targetUrl = apiUrl;

        // Logic to prefer Manager View if possible (to see drafts), but fallback to Employee View if Manager ID is missing
        if (managerId) {
            let candidateManagerUrl = '';

            if (import.meta.env.VITE_MANAGER_REVIEW_FORM_API_URL) {
                candidateManagerUrl = replaceUrlPlaceholders(import.meta.env.VITE_MANAGER_REVIEW_FORM_API_URL, employeeId, managerId);
            } else {
                // If no specific Manager API env var, try swapping /Employee for /Manager in the base URL
                candidateManagerUrl = apiUrl.replace('/Employee', '/Manager');
            }

            // Check if the candidate URL is valid (no generic placeholders left)
            if (candidateManagerUrl && !candidateManagerUrl.includes('{mgr_id}') && !candidateManagerUrl.includes('undefined')) {
                console.log('Using Manager View URL for Review Form');
                targetUrl = candidateManagerUrl;
            } else {
                console.warn('Constructed Manager URL was invalid (possibly missing ID). Falling back to Employee URL.');
            }
        } else {
            console.log('No Manager ID provided. Using Employee View URL for Review Form.');
        }

        console.log('Final Request URL for Review Form:', targetUrl);

        const response = await fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch Review Form: ${response.statusText}`);
        }

        let responseData = await response.json();
        console.log('Fetched Review Form Data:', JSON.stringify(responseData, null, 2));

        // Fallback Logic: If Manager View returns empty data, try Employee View
        // The API returns { success: true, data: [] } when no records are found.
        if (targetUrl !== apiUrl && (!responseData.data || (Array.isArray(responseData.data) && responseData.data.length === 0))) {
            console.warn("Manager View returned empty data. Retrying with Employee View URL:", apiUrl);

            // Check if we need to replace placeholders in the Employee URL (apiUrl) too
            let fallbackUrl = apiUrl;
            if (fallbackUrl.includes('{emp_id}') && employeeId) {
                fallbackUrl = replaceUrlPlaceholders(fallbackUrl, employeeId, managerId);
            }

            console.log("Fallback Request URL:", fallbackUrl);
            const retryResponse = await fetch(`${fallbackUrl}${fallbackUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                console.log('Fallback (Employee View) Data:', JSON.stringify(retryData, null, 2));
                // Only use retry data if it actually has content, otherwise stick to original (empty) or return retry anyway?
                // Returning retry is safer as it is the "correct" view for the employee at least.
                responseData = retryData;
            }
        }

        return responseData;
    } catch (error) {
        console.error('Error fetching Review Form:', error);
        return null;
    }
};

const getCompanyId = () => {
    return (new URLSearchParams(window.location.search).get('companyId')) || '6396f7d703546500086f0200';
};

// Mutex to prevent race conditions during concurrent updates
let updateMutex: Promise<any> = Promise.resolve();
let cachedReviewForm: any = null;
let lastReviewFetchTime = 0;

export const getFreshReviewForm = async (force: boolean = false, employeeId?: string, managerId?: string) => {
    const now = Date.now();
    if (!force && cachedReviewForm && (now - lastReviewFetchTime < 30000)) {
        return cachedReviewForm;
    }
    const fresh = await fetchReviewForm(employeeId, managerId);
    if (fresh) {
        cachedReviewForm = fresh;
        lastReviewFetchTime = now;
    }
    return cachedReviewForm;
};

export const clearReviewCache = () => {
    console.log("%c[CACHE] Clearing Review Form Cache...", "color: gray;");
    cachedReviewForm = null;
    lastReviewFetchTime = 0;
};

/**
 * Internal helper to apply incremental reviewData updates to a review object.
 * This contains all the merging, initialization, and stat recalculation logic.
 */
const applyUpdateToReviewObject = (reviewObj: any, reviewData: any) => {
    const finalReviewObj = { ...reviewObj };

    // Update Overall Comments
    if (!finalReviewObj.overallComments) finalReviewObj.overallComments = { cm1: '', cm2: '', cm3: '' };
    if (!finalReviewObj.overalComments) finalReviewObj.overalComments = { cm1: '', cm2: '', cm3: '' };

    if (reviewData.cm1 || reviewData.accomplishments || reviewData.keyAccomplishments) {
        const val = String(reviewData.cm1 || reviewData.accomplishments || reviewData.keyAccomplishments).trim();
        finalReviewObj.overallComments.cm1 = val;
        finalReviewObj.overalComments.cm1 = val;
    }
    if (reviewData.cm2 || reviewData.plan || reviewData.nextQuarterPlan) {
        const val = String(reviewData.cm2 || reviewData.plan || reviewData.nextQuarterPlan).trim();
        finalReviewObj.overallComments.cm2 = val;
        finalReviewObj.overalComments.cm2 = val;
    }
    if (reviewData.cm3 || reviewData.managerOverallComments) {
        const val = String(reviewData.cm3 || reviewData.managerOverallComments).trim();
        finalReviewObj.overallComments.cm3 = val;
        finalReviewObj.overalComments.cm3 = val;
        finalReviewObj.managerOverallComments = val;
    }

    const objectiveUpdates = Array.isArray(reviewData.objectiveReviews) ? reviewData.objectiveReviews : [];
    const krUpdates = Array.isArray(reviewData.keyResultReviews) ? reviewData.keyResultReviews : [];

    // Initialize goals if missing
    if (!Array.isArray(finalReviewObj.goals) || finalReviewObj.goals.length === 0) {
        finalReviewObj.goals = okrCache.map(o => ({
            _id: o._id || o.id,
            objective: o.objective || o.title || o.name,
            weight: o.weight || 0,
            progressStatus: o.progressStatus || o.progress || 0,
            employeeRating: 0,
            managerRating: 0,
            children: (o.children || o.keyResults || []).map((kr: any) => ({
                _id: kr._id || kr.id || kr.krID,
                keyResultName: kr.keyResultName || kr.okrName || kr.description || kr.title,
                target: kr.target || 0,
                actual: kr.actual || 0,
                employeeRating: 0,
                managerRating: 0
            }))
        }));
    }

    // Initialize competencies if missing
    if (!Array.isArray(finalReviewObj.competencies) || finalReviewObj.competencies.length === 0) {
        const competencyOrder = ["Ownership & Accountability", "Professionalism", "Customer Focus", "Leadership", "Collaboration"];
        const newComps: any[] = [];
        competencyOrder.forEach(name => {
            newComps.push({ competencyName: name, title: name, type: 'employee', Feedback: 0, Comments: '' });
            newComps.push({ competencyName: name, title: name, type: 'manager', Feedback: 0, Comments: '' });
        });
        finalReviewObj.competencies = newComps;
    }

    // Merge OKR Updates
    if (Array.isArray(finalReviewObj.goals)) {
        finalReviewObj.goals = finalReviewObj.goals.map((goal: any) => {
            const cachedOkr = okrCache.find(o =>
                String(o._id || o.id || "").trim() === String(goal._id || goal.id || "").trim() ||
                (o.objective || "").trim().toLowerCase() === (goal.objective || "").trim().toLowerCase()
            );

            let updatedGoal = { ...goal };
            if (cachedOkr) {
                updatedGoal.progressStatus = cachedOkr.progressStatus !== undefined ? cachedOkr.progressStatus : (cachedOkr.progress !== undefined ? cachedOkr.progress : updatedGoal.progressStatus);
                if (Array.isArray(updatedGoal.children)) {
                    let totalKrAchievement = 0;
                    updatedGoal.children = updatedGoal.children.map((kr: any) => {
                        const cachedKr = (cachedOkr.children || cachedOkr.keyResults || []).find((ck: any) =>
                            String(ck._id || ck.id || "").trim() === String(kr._id || kr.id || kr.krID || "").trim() ||
                            (ck.keyResultName || ck.description || "").trim().toLowerCase() === (kr.keyResultName || "").trim().toLowerCase()
                        );
                        if (cachedKr) {
                            const actual = cachedKr.actual !== undefined ? cachedKr.actual : (cachedKr.current !== undefined ? cachedKr.current : kr.actual);
                            const target = cachedKr.target !== undefined ? cachedKr.target : (cachedKr.targetValue !== undefined ? cachedKr.targetValue : kr.target);

                            // Calculate achievement for this KR (0-100%)
                            const achievement = target > 0 ? (Number(actual) / Number(target)) * 100 : 0;
                            totalKrAchievement += Math.min(100, achievement);

                            return { ...kr, actual, target };
                        }
                        return kr;
                    });

                    // Update Goal progressStatus based on average of children achievement
                    if (updatedGoal.children.length > 0) {
                        updatedGoal.progressStatus = Math.round(totalKrAchievement / updatedGoal.children.length);
                    }
                }
            }

            const objUpdate = objectiveUpdates.find((u: any) =>
                (u.id && String(u.id).trim() === String(goal._id || goal.id || "").trim()) ||
                (u.objectiveName && normalizeString(u.objectiveName) === normalizeString(goal.objective))
            );

            if (objUpdate) {
                if (objUpdate.employeeRating !== undefined) updatedGoal.employeeRating = Number(objUpdate.employeeRating);
                if (objUpdate.managerRating !== undefined) updatedGoal.managerRating = Number(objUpdate.managerRating);
                if (objUpdate.employeeFeedback !== undefined) updatedGoal.employeeFeedback = objUpdate.employeeFeedback;
                if (objUpdate.managerFeedback !== undefined) updatedGoal.managerFeedback = objUpdate.managerFeedback;
            }

            if (Array.isArray(updatedGoal.children)) {
                updatedGoal.children = updatedGoal.children.map((kr: any) => {
                    const krUpdate = krUpdates.find((u: any) =>
                        (u.id && String(u.id).trim() === String(kr._id || kr.id || kr.krID || "").trim()) ||
                        (u.keyResultName && normalizeString(u.keyResultName) === normalizeString(kr.keyResultName || kr.okrName || ""))
                    );
                    if (krUpdate) {
                        let updatedKr = { ...kr };
                        if (krUpdate.actual !== undefined) updatedKr.actual = krUpdate.actual;
                        if (krUpdate.employeeRating !== undefined) updatedKr.employeeRating = Number(krUpdate.employeeRating);
                        if (krUpdate.managerRating !== undefined) updatedKr.managerRating = Number(krUpdate.managerRating);
                        if (krUpdate.employeeFeedback !== undefined) updatedKr.employeeFeedback = krUpdate.employeeFeedback;
                        if (krUpdate.managerFeedback !== undefined) updatedKr.managerFeedback = krUpdate.managerFeedback;
                        return updatedKr;
                    }
                    return kr;
                });

                // RECALCULATE Objective Progress Status dynamically after ALL merges
                let totalKrAchievement = 0;
                updatedGoal.children.forEach((kr: any) => {
                    const actualValue = Number(kr.actual || 0);
                    const targetValue = Number(kr.target || 0);
                    const ach = targetValue > 0 ? (actualValue / targetValue) * 100 : 0;
                    totalKrAchievement += Math.min(100, ach);
                });
                if (updatedGoal.children.length > 0) {
                    updatedGoal.progressStatus = Math.round(totalKrAchievement / updatedGoal.children.length);
                }
            }
            return updatedGoal;
        });
    }

    // Merge Competency Updates
    const compUpdates = Array.isArray(reviewData.competencyReviews) ? reviewData.competencyReviews : [];
    if (compUpdates.length > 0) {
        const updatedCompetencies = [...(finalReviewObj.competencies || [])];
        compUpdates.forEach((update: any) => {
            const uName = normalizeString(update.competencyName || update.name || "");
            if (!uName) return;
            const matchComp = (cName: string) => {
                const n = normalizeString(cName || "");
                return n === uName || n.includes(uName) || uName.includes(n) || n.replace(/\s/g, '') === uName.replace(/\s/g, '');
            };
            const empIdx = updatedCompetencies.findIndex(c => c.type === 'employee' && matchComp(c.competencyName || c.title));
            if (empIdx !== -1) {
                if (update.employeeRating !== undefined) updatedCompetencies[empIdx].Feedback = Math.round(Number(update.employeeRating));
                const empCmt = update.employeeComment || update.employeeComments || update.employeeReason || update.selfComment || update.reason || update.comment;
                if (empCmt) {
                    updatedCompetencies[empIdx].Comments = String(empCmt).trim();
                    updatedCompetencies[empIdx].comments = String(empCmt).trim();
                }
            }
            const mgrIdx = updatedCompetencies.findIndex(c => c.type === 'manager' && matchComp(c.competencyName || c.title));
            if (mgrIdx !== -1) {
                if (update.managerRating !== undefined) updatedCompetencies[mgrIdx].Feedback = Math.round(Number(update.managerRating));
                const mgrCmt = update.managerComment || update.managerComments || update.managerReason || update.supervisorComment || update.reason || update.comment;
                if (mgrCmt) {
                    updatedCompetencies[mgrIdx].Comments = String(mgrCmt).trim();
                    updatedCompetencies[mgrIdx].comments = String(mgrCmt).trim();
                }
            }
        });
        finalReviewObj.competencies = updatedCompetencies;
    }

    // Recalculate Stats
    const getRatingList = (type: 'employee' | 'manager') => {
        const list: number[] = [];
        const field = type === 'employee' ? 'employeeRating' : 'managerRating';
        if (finalReviewObj.goals) {
            finalReviewObj.goals.forEach((g: any) => {
                if (g[field] && !isNaN(Number(g[field])) && Number(g[field]) > 0) list.push(Number(g[field]));
                if (g.children) {
                    g.children.forEach((kr: any) => {
                        if (kr[field] && !isNaN(Number(kr[field])) && Number(kr[field]) > 0) list.push(Number(kr[field]));
                    });
                }
            });
        }
        if (finalReviewObj.competencies) {
            finalReviewObj.competencies.forEach((c: any) => {
                if (c.type === type && c.Feedback && !isNaN(Number(c.Feedback)) && Number(c.Feedback) > 0) list.push(Number(c.Feedback));
            });
        }
        return list;
    };

    const er = getRatingList('employee');
    const mr = getRatingList('manager');
    const ea = er.length ? (er.reduce((a, b) => a + b, 0) / er.length) : 0;
    const ma = mr.length ? (mr.reduce((a, b) => a + b, 0) / mr.length) : 0;

    finalReviewObj.employeesRating = Number(ea.toFixed(2));
    finalReviewObj.managersRating = Number(ma.toFixed(2));
    finalReviewObj.overallRating = Number(((ea * 0.4) + (ma * 0.6)).toFixed(2));

    let totalAch = 0;
    if (finalReviewObj.goals) {
        finalReviewObj.goals.forEach((g: any) => {
            const weight = Number(g.weight || 0);
            const progress = Number(g.progressStatus || g.progress || 0);
            totalAch += (progress * weight) / 100;
        });
    }
    finalReviewObj.totalAchievement = Math.min(100, Number(totalAch.toFixed(2)));

    return finalReviewObj;
};

/**
 * Optimistically updates the cached review form and dispatches a UI event.
 */
const optimisticUpdateCache = (reviewData: any) => {
    if (!cachedReviewForm || !cachedReviewForm.data) return;

    const targetReviewId = (reviewData.id || reviewData._id || "").trim();
    const sessionEmpName = reviewData.employeeFullName || '';

    let reviewDataArray = Array.isArray(cachedReviewForm.data) ? cachedReviewForm.data :
        (cachedReviewForm.data?.review ? [cachedReviewForm.data.review] :
            (cachedReviewForm.data?.data ? (Array.isArray(cachedReviewForm.data.data) ? cachedReviewForm.data.data : [cachedReviewForm.data.data]) :
                (cachedReviewForm.data ? [cachedReviewForm.data] : [])));

    let reviewObj = reviewDataArray.find((r: any) => targetReviewId && (String(r._id).toLowerCase() === targetReviewId.toLowerCase() || String(r.id).toLowerCase() === targetReviewId.toLowerCase()));
    if (!reviewObj) {
        reviewObj = reviewDataArray.find((r: any) => (sessionEmpName && normalizeString(r.employeeFullName).includes(normalizeString(sessionEmpName))));
    }
    if (!reviewObj) {
        reviewObj = reviewDataArray.find((r: any) => r.employeeId === '68e240b0d9876d59139672d6') || reviewDataArray[0];
    }

    if (reviewObj) {
        const updatedObj = applyUpdateToReviewObject(reviewObj, reviewData);
        // Find index in original array to replace
        const idx = reviewDataArray.findIndex((r: any) => r._id === reviewObj._id);
        if (idx !== -1) {
            reviewDataArray[idx] = updatedObj;
            // Update the wrapper accordingly
            if (Array.isArray(cachedReviewForm.data)) cachedReviewForm.data = [...reviewDataArray];
            else if (cachedReviewForm.data?.review) cachedReviewForm.data.review = updatedObj;
            else if (cachedReviewForm.data?.data) {
                if (Array.isArray(cachedReviewForm.data.data)) cachedReviewForm.data.data = [...reviewDataArray];
                else cachedReviewForm.data.data = updatedObj;
            } else cachedReviewForm.data = updatedObj;

            console.log("%c[OPTIMISTIC] Local cache updated. Dispatching event...", "color: orange;");
            window.dispatchEvent(new CustomEvent('review-data-updated'));
        }
    }
};

export const submitEmployeeSelfAssessment = async (reviewData: any): Promise<boolean> => {
    // Optimistic Update: Update cache and trigger UI immediately
    optimisticUpdateCache(reviewData);

    const result = await (updateMutex = updateMutex.then(async () => {
        try {
            console.log("%c[SUBMISSION] Starting Employee Self-Assessment Sync...", "color: cyan; font-weight: bold;");

            if (okrCache.length === 0) await fetchEmployeeOKRs();
            const fullReviewData = await getFreshReviewForm();
            if (!fullReviewData || !fullReviewData.data) return false;

            const providedId = (reviewData.id || reviewData._id || "").trim();
            let reviewDataArray = Array.isArray(fullReviewData.data) ? fullReviewData.data :
                (fullReviewData.data?.review ? [fullReviewData.data.review] :
                    (fullReviewData.data?.data ? (Array.isArray(fullReviewData.data.data) ? fullReviewData.data.data : [fullReviewData.data.data]) :
                        (fullReviewData.data ? [fullReviewData.data] : [])));

            reviewDataArray = reviewDataArray.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            let reviewObj = reviewDataArray.find((r: any) =>
                providedId && (String(r._id).toLowerCase() === providedId.toLowerCase() || String(r.id).toLowerCase() === providedId.toLowerCase())
            );

            if (!reviewObj) {
                const sessionEmpName = reviewData.employeeFullName || '';
                reviewObj = reviewDataArray.find((r: any) => sessionEmpName && normalizeString(r.employeeFullName).includes(normalizeString(sessionEmpName)));
            }
            if (!reviewObj) reviewObj = reviewDataArray.find((r: any) => r.employeeId === '68e240b0d9876d59139672d6') || reviewDataArray[0];
            if (!reviewObj) return false;

            const finalReviewObj = applyUpdateToReviewObject(reviewObj, reviewData);
            const cleanPayload = JSON.parse(JSON.stringify(finalReviewObj));

            // Cleanup metadata for API
            ['__v', 'createdAt', 'updatedAt'].forEach(f => delete cleanPayload[f]);
            if (cleanPayload.companyId?._id) cleanPayload.companyId = String(cleanPayload.companyId._id);
            if (cleanPayload.employeeId?._id) cleanPayload.employeeId = String(cleanPayload.employeeId._id);

            const apiKey = import.meta.env.VITE_EMPLOYEE_API_KEY;

            // Construct Submission URL
            let url = '';
            const managerUpdateUrl = import.meta.env.VITE_MANAGER_REVIEW_UPDATE_URL;

            if (managerUpdateUrl && managerUpdateUrl.includes('{form_id}')) {
                // REQ: Replace {form_id} with the found form ID
                url = managerUpdateUrl.replace('{form_id}', reviewObj._id);
            } else {
                // Fallback to Employee URL or default construction
                url = `${import.meta.env.VITE_SUBMIT_REVIEW_API_URL || 'https://ai.talentspotifyapp.com/api/reviewForm/updateReviewForm'}/${reviewObj._id}?companyId=${getCompanyId()}`;
            }

            console.log("[SUBMISSION] URL:", url);

            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(cleanPayload)
            });

            if (response.ok) {
                console.log("%c[SUBMISSION] Sync Success", "color: green;");
                cachedReviewForm = { ...fullReviewData, data: cleanPayload };
                window.dispatchEvent(new CustomEvent('review-data-updated'));
                return true;
            }
            return false;
        } catch (e) {
            console.error("[SUBMISSION] Sync Error:", e);
            return false;
        }
    }));
    return !!result;
};

export const updateKeyResultWithRating = async (id: string, currentValue: string, rating?: number): Promise<boolean> => {
    return updateKeyResult(id, currentValue);
};

export const submitCompetencyReview = async (reviewData: any): Promise<boolean> => {
    // Optimistic Update
    optimisticUpdateCache(reviewData);

    const result = await (updateMutex = updateMutex.then(async () => {
        try {
            console.log("%c[SUBMISSION] Starting Competency Sync...", "color: cyan; font-weight: bold;");

            if (okrCache.length === 0) await fetchEmployeeOKRs();
            const fullReviewData = await getFreshReviewForm();
            if (!fullReviewData || !fullReviewData.data) return false;

            const providedId = (reviewData.id || reviewData._id || "").trim();
            let reviewDataArray = Array.isArray(fullReviewData.data) ? fullReviewData.data :
                (fullReviewData.data?.review ? [fullReviewData.data.review] :
                    (fullReviewData.data?.data ? (Array.isArray(fullReviewData.data.data) ? fullReviewData.data.data : [fullReviewData.data.data]) :
                        (fullReviewData.data ? [fullReviewData.data] : [])));

            reviewDataArray = reviewDataArray.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            let reviewObj = reviewDataArray.find((r: any) =>
                providedId && (String(r._id).toLowerCase() === providedId.toLowerCase() || String(r.id).toLowerCase() === providedId.toLowerCase())
            );

            if (!reviewObj) {
                const sessionEmpName = reviewData.employeeFullName || '';
                reviewObj = reviewDataArray.find((r: any) => sessionEmpName && normalizeString(r.employeeFullName).includes(normalizeString(sessionEmpName)));
            }
            if (!reviewObj) reviewObj = reviewDataArray.find((r: any) => r.employeeId === '68e240b0d9876d59139672d6') || reviewDataArray[0];
            if (!reviewObj) return false;

            const finalReviewObj = applyUpdateToReviewObject(reviewObj, reviewData);
            const cleanPayload = JSON.parse(JSON.stringify(finalReviewObj));

            ['__v', 'createdAt', 'updatedAt'].forEach(f => delete cleanPayload[f]);
            if (cleanPayload.companyId?._id) cleanPayload.companyId = String(cleanPayload.companyId._id);
            if (cleanPayload.employeeId?._id) cleanPayload.employeeId = String(cleanPayload.employeeId._id);

            const apiKey = import.meta.env.VITE_EMPLOYEE_API_KEY;

            // Construct Submission URL
            let url = '';
            const managerUpdateUrl = import.meta.env.VITE_MANAGER_REVIEW_UPDATE_URL;

            if (managerUpdateUrl && managerUpdateUrl.includes('{form_id}')) {
                // REQ: Replace {form_id} with the found form ID
                url = managerUpdateUrl.replace('{form_id}', reviewObj._id);
            } else {
                // Fallback to Employee URL or default construction
                url = `${import.meta.env.VITE_SUBMIT_REVIEW_API_URL || 'https://ai.talentspotifyapp.com/api/reviewForm/updateReviewForm'}/${reviewObj._id}?companyId=${getCompanyId()}`;
            }

            console.log("[SUBMISSION] URL:", url);

            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(cleanPayload)
            });

            if (response.ok) {
                console.log("%c[SUBMISSION] Sync Success", "color: green;");
                cachedReviewForm = { ...fullReviewData, data: cleanPayload };
                window.dispatchEvent(new CustomEvent('review-data-updated'));
                return true;
            }
            return false;
        } catch (e) {
            console.error("[SUBMISSION] Sync Error:", e);
            return false;
        }
    }));
    return !!result;
};

export const updateKeyResult = async (id: string, currentValue: string): Promise<boolean> => {
    // Optimistic Update for report view
    if (cachedReviewForm && cachedReviewForm.data) {
        // Sync to review form goals children immediately
        const dummyReviewData = { keyResultReviews: [{ id, actual: Number(currentValue) }] };
        optimisticUpdateCache(dummyReviewData);
    }

    const apiKey = import.meta.env.VITE_EMPLOYEE_API_KEY;
    const updateUrlBase = import.meta.env.VITE_UPDATE_KEY_RESULT_API_URL || 'https://ai.talentspotifyapp.com/api/keyresults/updatekeyResult';
    const companyId = getCompanyId();

    try {
        let fullKeyResultObj: any = null;
        let objectiveIndex = -1;
        let krIndex = -1;

        for (let i = 0; i < okrCache.length; i++) {
            const objective = okrCache[i];
            const children = objective.children || objective.keyResults || [];
            const foundIndex = children.findIndex((kr: any) => String(kr.id || kr._id || kr.krID || "").trim() === String(id || "").trim());
            if (foundIndex !== -1) {
                fullKeyResultObj = { ...children[foundIndex] };
                objectiveIndex = i;
                krIndex = foundIndex;
                break;
            }
        }

        if (fullKeyResultObj) {
            fullKeyResultObj.actual = parseInt(currentValue, 10);
            fullKeyResultObj.updatedAt = new Date().toISOString();
        } else {
            fullKeyResultObj = { actual: currentValue };
        }

        const url = `${updateUrlBase}/${id}?companyId=${companyId}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(fullKeyResultObj)
        });

        if (response.ok) {
            if (objectiveIndex !== -1 && krIndex !== -1) {
                okrCache[objectiveIndex].children[krIndex] = { ...okrCache[objectiveIndex].children[krIndex], ...fullKeyResultObj };
            }
            window.dispatchEvent(new CustomEvent('review-data-updated'));
            return true;
        }
        return false;
    } catch (error) {
        console.error('[OKR UPDATE] Error:', error);
        return false;
    }
};
