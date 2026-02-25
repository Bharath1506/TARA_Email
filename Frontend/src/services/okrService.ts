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

// Persistence Keys
const CACHE_KEY_OKR = 'tara_okr_cache';
const CACHE_KEY_REVIEW = 'tara_review_cache';

// Cache to store the full KR objects so we can send complete payloads on update
let okrCache: any[] = JSON.parse(sessionStorage.getItem(CACHE_KEY_OKR) || '[]');
let cachedReviewForm: any = JSON.parse(sessionStorage.getItem(CACHE_KEY_REVIEW) || 'null');

// Simulation State: Start with mock data if API keys are missing
const MOCK_OKRS = [
    {
        _id: "o1",
        objective: "Increase Revenue",
        weight: 50,
        progressStatus: 0,
        children: [
            {
                _id: "k1",
                keyResultName: "Increase Sales by 30% compared to last year",
                target: 30,
                actual: 0,
                unit: "%"
            }
        ]
    },
    {
        _id: "o2",
        objective: "Expand Customer Success Team",
        weight: 50,
        progressStatus: 0,
        children: [
            {
                _id: "k2",
                keyResultName: "Hire 10 new team members",
                target: 10,
                actual: 0,
                unit: "people"
            }
        ]
    }
];

const MOCK_REVIEW_FORM = {
    success: true,
    data: {
        review: {
            _id: "sim-review-123",
            employeeId: "sim-emp-1",
            employeeFullName: "Ravi K",
            managerId: "sim-mgr-1",
            managerName: "Madhavi",
            status: "Draft",
            overallRating: 0,
            totalAchievement: 0,
            goals: [],
            competencies: [],
            overalComments: { cm1: "", cm2: "", cm3: "" },
            overallComments: { cm1: "", cm2: "", cm3: "" }
        }
    }
};

// Helper to replace placeholders
const replaceUrlPlaceholders = (url: string, employeeId?: string, managerId?: string) => {
    let newUrl = url;
    const companyId = getCompanyId();

    if (newUrl.includes('{company_id}')) {
        newUrl = newUrl.replace(/\{company_id\}/g, companyId);
    }
    if (employeeId) {
        newUrl = newUrl.replace(/\{emp_id\}/g, employeeId)
            .replace(/\{userId\}/g, employeeId);
    }
    if (managerId) {
        newUrl = newUrl.replace(/\{mgr_id\}/g, managerId);
    }
    return newUrl;
};

export const fetchEmployeeOKRs = async (employeeId?: string, managerId?: string): Promise<OKR[]> => {
    const apiKey = import.meta.env.VITE_EMPLOYEE_API_KEY;
    let apiUrl = import.meta.env.VITE_OKR_API_URL;

    if (apiUrl) {
        apiUrl = replaceUrlPlaceholders(apiUrl, employeeId, managerId);
        if (employeeId && !apiUrl.includes('userId=') && !apiUrl.includes('empId=')) {
            const separator = apiUrl.includes('?') ? '&' : '?';
            apiUrl = `${apiUrl}${separator}userId=${employeeId}&empId=${employeeId}`;
        }
    }

    if (!apiKey || !apiUrl) {
        console.warn('OKR API key or URL is missing. Returning MOCK OKRs for simulation.');
        okrCache = MOCK_OKRS;
        return MOCK_OKRS.map((item: any) => ({
            id: item._id || item.id,
            objective: item.objective,
            keyResults: (item.children || []).map((kr: any) => ({
                id: kr._id,
                description: kr.keyResultName,
                target: String(kr.target),
                current: String(kr.actual),
                metrics: kr.unit || ''
            }))
        }));
    }

    try {
        if (apiUrl.includes('{emp_id}') || apiUrl.includes('{mgr_id}') || apiUrl.includes('{userId}')) {
            console.warn("Aborting OKR fetch: URL contains unresolved placeholders.", apiUrl);
            return [];
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
        let objectivesList: any[] = [];
        if (Array.isArray(data)) objectivesList = data;
        else if (data && Array.isArray(data.data)) objectivesList = data.data;
        else if (data && Array.isArray(data.objectives)) objectivesList = data.objectives;

        console.log("%c[DATA] Detailed OKR Status", "color: white; background: #4CAF50; font-weight: bold; padding: 2px 5px;");
        const flatKRs = objectivesList.flatMap(o =>
            (o.children || o.keyResults || []).map((kr: any) => ({
                Objective: o.objective || o.title || o.name,
                'Key Result': kr.keyResultName || kr.okrName || kr.description,
                'Actual Value': kr.actual || kr.current || kr.currentValue || 0,
                'Target Value': kr.target || kr.targetValue || 0,
                Unit: kr.unit || kr.uom || kr.metrics || ''
            }))
        );
        console.table(flatKRs);

        okrCache = objectivesList;
        sessionStorage.setItem(CACHE_KEY_OKR, JSON.stringify(okrCache));
        syncReviewWithOKRs();

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

    if (apiUrl) apiUrl = replaceUrlPlaceholders(apiUrl, employeeId, managerId);

    if (!apiKey || !apiUrl) {
        console.warn('Review API key or URL is missing. Returning MOCK Review Form for simulation.');
        return MOCK_REVIEW_FORM;
    }

    try {
        let targetUrl = apiUrl;
        if (managerId) {
            let candidateManagerUrl = '';
            if (import.meta.env.VITE_MANAGER_REVIEW_FORM_API_URL) candidateManagerUrl = replaceUrlPlaceholders(import.meta.env.VITE_MANAGER_REVIEW_FORM_API_URL, employeeId, managerId);
            else candidateManagerUrl = apiUrl.replace('/Employee', '/Manager');

            if (candidateManagerUrl && !candidateManagerUrl.includes('{mgr_id}') && !candidateManagerUrl.includes('undefined')) {
                console.log('Using Manager View URL for Review Form');
                targetUrl = candidateManagerUrl;
            }
        }

        console.log('Final Request URL for Review Form:', targetUrl);
        const response = await fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`Failed to fetch Review Form: ${response.statusText}`);

        let responseData = await response.json();
        const review = responseData.data?.review || (Array.isArray(responseData.data) ? responseData.data[0] : (responseData.data?.data ? (Array.isArray(responseData.data.data) ? responseData.data.data[0] : responseData.data.data) : responseData.data));

        if (review) {
            console.log("%c[DATA] Detailed Review Form Status", "color: white; background: #2196F3; font-weight: bold; padding: 2px 5px;");
            console.table({
                "Form ID": review._id || review.id,
                "Employee": review.employeeFullName,
                "Manager": review.managerName,
                "Status": review.status,
                "Achievement": (review.totalAchievement || 0) + "%"
            });
            const feedback = {
                "Key Accomplishments": review.cm1 || review.accomplishments || review.keyAccomplishments || review.overallComments?.cm1 || review.overalComments?.cm1 || 'None',
                "Next Quarter Plan": review.cm2 || review.plan || review.nextQuarterPlan || review.overallComments?.cm2 || review.overalComments?.cm2 || 'None',
                "Manager Overall Comments": review.cm3 || review.managerOverallComments || review.overallComments?.cm3 || review.overalComments?.cm3 || 'None'
            };
            console.log("%c[DATA] Qualitative Feedback", "color: #2196F3; font-weight: bold;");
            console.table(feedback);
        }

        if (targetUrl !== apiUrl && (!responseData.data || (Array.isArray(responseData.data) && responseData.data.length === 0))) {
            let fallbackUrl = apiUrl;
            if (fallbackUrl.includes('{emp_id}') && employeeId) fallbackUrl = replaceUrlPlaceholders(fallbackUrl, employeeId, managerId);
            const retryResponse = await fetch(`${fallbackUrl}${fallbackUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            });
            if (retryResponse.ok) responseData = await retryResponse.json();
        }

        return responseData;
    } catch (error) {
        console.error('Error fetching Review Form:', error);
        return null;
    }
};

const getCompanyId = () => (new URLSearchParams(window.location.search).get('companyId')) || import.meta.env.VITE_COMPANY_ID || '6396f7d703546500086f0200';

let updateMutex: Promise<any> = Promise.resolve();
let lastReviewFetchTime = 0;

export const getFreshReviewForm = async (force: boolean = false, employeeId?: string, managerId?: string) => {
    const now = Date.now();
    if (!force && cachedReviewForm && (now - lastReviewFetchTime < 30000)) return cachedReviewForm;
    const fresh = await fetchReviewForm(employeeId, managerId);
    if (fresh) {
        cachedReviewForm = fresh;
        sessionStorage.setItem(CACHE_KEY_REVIEW, JSON.stringify(cachedReviewForm));
        syncReviewWithOKRs(true);
        lastReviewFetchTime = now;
    }
    return cachedReviewForm;
};

export const clearReviewCache = () => {
    cachedReviewForm = null;
    sessionStorage.removeItem(CACHE_KEY_REVIEW);
    sessionStorage.removeItem(CACHE_KEY_OKR);
    lastReviewFetchTime = 0;
};

export const syncReviewWithOKRs = (silent: boolean = false) => {
    if (!cachedReviewForm || !cachedReviewForm.data) return;
    let reviewDataArray = Array.isArray(cachedReviewForm.data) ? cachedReviewForm.data :
        (cachedReviewForm.data?.review ? [cachedReviewForm.data.review] :
            (cachedReviewForm.data?.data ? (Array.isArray(cachedReviewForm.data.data) ? cachedReviewForm.data.data : [cachedReviewForm.data.data]) :
                (cachedReviewForm.data ? [cachedReviewForm.data] : [])));
    if (reviewDataArray.length > 0) {
        const updated = applyUpdateToReviewObject(reviewDataArray[0], {});
        if (Array.isArray(cachedReviewForm.data)) cachedReviewForm.data[0] = updated;
        else if (cachedReviewForm.data?.review) cachedReviewForm.data.review = updated;
        else if (cachedReviewForm.data?.data) {
            if (Array.isArray(cachedReviewForm.data.data)) cachedReviewForm.data.data[0] = updated;
            else cachedReviewForm.data.data = updated;
        } else cachedReviewForm.data = updated;
        sessionStorage.setItem(CACHE_KEY_REVIEW, JSON.stringify(cachedReviewForm));
        if (!silent) window.dispatchEvent(new CustomEvent('review-data-updated'));
    }
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
        finalReviewObj.cm1 = val;
        finalReviewObj.accomplishments = val;
        finalReviewObj.keyAccomplishments = val;
    }
    if (reviewData.cm2 || reviewData.plan || reviewData.nextQuarterPlan) {
        const val = String(reviewData.cm2 || reviewData.plan || reviewData.nextQuarterPlan).trim();
        finalReviewObj.overallComments.cm2 = val;
        finalReviewObj.overalComments.cm2 = val;
        finalReviewObj.cm2 = val;
        finalReviewObj.plan = val;
        finalReviewObj.nextQuarterPlan = val;
    }
    if (reviewData.cm3 || reviewData.managerOverallComments) {
        const val = String(reviewData.cm3 || reviewData.managerOverallComments).trim();
        finalReviewObj.overallComments.cm3 = val;
        finalReviewObj.overalComments.cm3 = val;
        finalReviewObj.cm3 = val;
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

    // Merge OKR Updates (Objectives + Key Results)
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
                            const achievement = target > 0 ? (Number(actual) / Number(target)) * 100 : 0;
                            totalKrAchievement += Math.min(100, achievement);
                            return { ...kr, actual, target };
                        }
                        return kr;
                    });
                    if (updatedGoal.children.length > 0) {
                        updatedGoal.progressStatus = Math.round(totalKrAchievement / updatedGoal.children.length);
                    }
                }
            }

            // Merge Objective rating updates
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

            // Merge Key Result rating updates
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
    if (!reviewObj && sessionEmpName) reviewObj = reviewDataArray.find((r: any) => normalizeString(r.employeeFullName).includes(normalizeString(sessionEmpName)));
    if (!reviewObj && reviewData.employeeId) {
        const targetEmpId = String(reviewData.employeeId).trim().toLowerCase();
        reviewObj = reviewDataArray.find((r: any) => String(r.employeeId?._id || r.employeeId || "").trim().toLowerCase() === targetEmpId);
    }
    if (!reviewObj) reviewObj = reviewDataArray[0];

    if (reviewObj) {
        const updatedObj = applyUpdateToReviewObject(reviewObj, reviewData);
        const idx = reviewDataArray.findIndex((r: any) => (r._id || r.id) === (reviewObj._id || reviewObj.id));
        if (idx !== -1) {
            reviewDataArray[idx] = updatedObj;
            if (Array.isArray(cachedReviewForm.data)) cachedReviewForm.data = [...reviewDataArray];
            else if (cachedReviewForm.data?.review) cachedReviewForm.data.review = updatedObj;
            else if (cachedReviewForm.data?.data) {
                if (Array.isArray(cachedReviewForm.data.data)) cachedReviewForm.data.data = [...reviewDataArray];
                else cachedReviewForm.data.data = updatedObj;
            } else cachedReviewForm.data = updatedObj;
            sessionStorage.setItem(CACHE_KEY_REVIEW, JSON.stringify(cachedReviewForm));
            console.log("%c[OPTIMISTIC] Local cache updated. Dispatching event...", "color: orange;");
            window.dispatchEvent(new CustomEvent('review-data-updated'));
        }
    }
};

export const submitEmployeeSelfAssessment = async (reviewData: any): Promise<boolean> => {
    // Optimistic Update FIRST (for instant UI)
    optimisticUpdateCache(reviewData);

    const result = await (updateMutex = updateMutex.then(async () => {
        try {
            if (okrCache.length === 0) await fetchEmployeeOKRs();
            // BUG FIX: Use cached form (already populated at session start) instead of re-fetching without IDs
            const fullReviewData = cachedReviewForm || await getFreshReviewForm();
            if (!fullReviewData || !fullReviewData.data) {
                console.error("[SUBMISSION] No review data available.");
                return false;
            }

            const providedId = (reviewData.id || reviewData._id || "").trim();
            let reviewDataArray = Array.isArray(fullReviewData.data) ? fullReviewData.data :
                (fullReviewData.data?.review ? [fullReviewData.data.review] :
                    (fullReviewData.data?.data ? (Array.isArray(fullReviewData.data.data) ? fullReviewData.data.data : [fullReviewData.data.data]) :
                        (fullReviewData.data ? [fullReviewData.data] : [])));

            reviewDataArray = reviewDataArray.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            // 1. Match by ID
            let reviewObj = reviewDataArray.find((r: any) =>
                providedId && (String(r._id).toLowerCase() === providedId.toLowerCase() || String(r.id).toLowerCase() === providedId.toLowerCase())
            );

            // 2. Match by Employee Name
            if (!reviewObj) {
                const sessionEmpName = reviewData.employeeFullName || '';
                reviewObj = reviewDataArray.find((r: any) => sessionEmpName && normalizeString(r.employeeFullName).includes(normalizeString(sessionEmpName)));
            }

            // 3. Match by Employee ID
            if (!reviewObj && reviewData.employeeId) {
                const targetEmpId = String(reviewData.employeeId).trim().toLowerCase();
                reviewObj = reviewDataArray.find((r: any) => {
                    const rEmpId = String(r.employeeId?._id || r.employeeId || "").trim().toLowerCase();
                    return rEmpId === targetEmpId;
                });
            }

            // 4. Ultimate Fallback: Most recent record
            if (!reviewObj) {
                console.warn("[SUBMISSION] No precise match found. Falling back to most recent record.");
                reviewObj = reviewDataArray[0];
            }
            if (!reviewObj) {
                console.error("[SUBMISSION] No review record found at all.");
                return false;
            }

            console.log("%c[SUBMISSION] Target Review Record:", "color: cyan;", {
                _id: reviewObj._id,
                employee: reviewObj.employeeFullName,
                status: reviewObj.status
            });

            const finalReviewObj = applyUpdateToReviewObject(reviewObj, reviewData);
            const cleanPayload = JSON.parse(JSON.stringify(finalReviewObj));

            // Clean fields that the API might reject
            ['__v', 'createdAt', 'updatedAt'].forEach(f => delete cleanPayload[f]);
            if (cleanPayload.companyId?._id) cleanPayload.companyId = String(cleanPayload.companyId._id);
            if (cleanPayload.employeeId?._id) cleanPayload.employeeId = String(cleanPayload.employeeId._id);

            const apiKey = import.meta.env.VITE_EMPLOYEE_API_KEY;
            const submitApiUrl = import.meta.env.VITE_SUBMIT_REVIEW_API_URL;
            const managerUpdateUrl = import.meta.env.VITE_MANAGER_REVIEW_UPDATE_URL;

            if (!apiKey || (!submitApiUrl && !managerUpdateUrl)) {
                console.log("%c[SIMULATION] Saved detail internally.", "color: green; font-weight: bold;");
                return true;
            }

            // Construct Submission URL
            let submissionUrl = managerUpdateUrl || submitApiUrl;
            const reviewId = String(finalReviewObj._id || finalReviewObj.id || "");

            // SANITIZE IDs for URL substitution (prevent [object Object])
            const urlEmpId = typeof finalReviewObj.employeeId === 'object' ? (finalReviewObj.employeeId._id || finalReviewObj.employeeId.id) : finalReviewObj.employeeId;
            const urlMgrId = typeof finalReviewObj.managerId === 'object' ? (finalReviewObj.managerId._id || finalReviewObj.managerId.id) : finalReviewObj.managerId;

            submissionUrl = replaceUrlPlaceholders(submissionUrl, String(urlEmpId || ""), String(urlMgrId || ""));
            if (submissionUrl.includes('{form_id}') && reviewId) {
                submissionUrl = submissionUrl.replace('{form_id}', reviewId);
            }

            const companyId = getCompanyId();
            if (!submissionUrl.includes('companyId=') && companyId) {
                submissionUrl += `${submissionUrl.includes('?') ? '&' : '?'}companyId=${companyId}`;
            }

            const isUpdate = reviewId && submissionUrl.includes(reviewId);
            const method = isUpdate ? 'PUT' : 'POST';

            console.log(`%c[SUBMISSION] Syncing feedback to backend (${method})...`, "color: cyan;", submissionUrl);
            console.log(`%c[SUBMISSION] Payload preview:`, "color: gray;", {
                cm1: cleanPayload.cm1 || cleanPayload.overallComments?.cm1,
                cm2: cleanPayload.cm2 || cleanPayload.overallComments?.cm2,
                cm3: cleanPayload.cm3 || cleanPayload.overallComments?.cm3,
                goalsCount: cleanPayload.goals?.length,
                competenciesCount: cleanPayload.competencies?.length
            });

            const response = await fetch(submissionUrl, {
                method,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(cleanPayload)
            });

            if (response.ok) {
                console.log(`%c[SUBMISSION] Successfully synced feedback to backend (${method}).`, "color: green; font-weight: bold;");

                // Update cache with the confirmed data
                optimisticUpdateCache(reviewData);
                sessionStorage.setItem(CACHE_KEY_REVIEW, JSON.stringify(cachedReviewForm));

                // Trigger UI refresh
                window.dispatchEvent(new CustomEvent('review-data-updated'));
                return true;
            } else {
                const errorStatus = response.status;
                const errorData = await response.text();
                console.error("[SUBMISSION] Feedback Sync Failed:", errorStatus, errorData);

                // FALLBACK: If PUT failed, try POST to the base URL
                if (method === 'PUT' && submitApiUrl) {
                    console.log("%c[SUBMISSION] Attempting POST fallback to base URL...", "color: orange;");
                    try {
                        const fallbackResponse = await fetch(submitApiUrl, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(cleanPayload)
                        });

                        if (fallbackResponse.ok) {
                            console.log("%c[SUBMISSION] POST Fallback Successful!", "color: green; font-weight: bold;");
                            optimisticUpdateCache(reviewData);
                            sessionStorage.setItem(CACHE_KEY_REVIEW, JSON.stringify(cachedReviewForm));
                            window.dispatchEvent(new CustomEvent('review-data-updated'));
                            return true;
                        } else {
                            const fallbackError = await fallbackResponse.text();
                            console.error("[SUBMISSION] POST Fallback also failed:", fallbackResponse.status, fallbackError);
                        }
                    } catch (fallbackErr) {
                        console.error("[SUBMISSION] POST Fallback Error:", fallbackErr);
                    }
                }
                return false;
            }
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
    // Both self-assessment and competency review update the same Review Form object
    return submitEmployeeSelfAssessment(reviewData);
};

export const updateKeyResult = async (id: string, currentValue: string): Promise<boolean> => {
    // Optimistic Update for report view
    if (cachedReviewForm && cachedReviewForm.data) {
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

        if (!apiKey || !import.meta.env.VITE_UPDATE_KEY_RESULT_API_URL) {
            console.log("%c[SIMULATION] Key Result updated internally.", "color: green;");
            if (objectiveIndex !== -1 && krIndex !== -1) {
                okrCache[objectiveIndex].children[krIndex] = { ...okrCache[objectiveIndex].children[krIndex], ...fullKeyResultObj };
            }
            window.dispatchEvent(new CustomEvent('review-data-updated'));
            return true;
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
                sessionStorage.setItem(CACHE_KEY_OKR, JSON.stringify(okrCache));
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
