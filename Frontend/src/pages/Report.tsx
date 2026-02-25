import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Printer, Target, BarChart3, MessageSquare, ClipboardList, Info, Loader2, Calendar, Clock } from 'lucide-react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Legend as RechartsLegend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell
} from 'recharts';
import {
    Tooltip as UITooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { OKRTable } from '@/components/OKRTable';
import { CompetencyTable } from '@/components/CompetencyTable';
import { getFreshReviewForm, fetchEmployeeOKRs } from '@/services/okrService';
import logoImage from '@/assets/talentspotify-logo.png';

// Scroll to section helper
const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
};

const Report = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [reviewData, setReviewData] = useState<any>(null);
    const messages = location.state?.messages || [];
    const callStartTime = location.state?.callStartTime;
    const stateEmployeeName = location.state?.employeeName;
    const stateManagerName = location.state?.managerName;
    const stateEmployeeId = location.state?.employeeId;
    const stateManagerId = location.state?.managerId;
    const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
    const loadingRef = useRef(false);

    const handleLegendClick = (e: any) => {
        const seriesName = e.value;
        setSelectedSeries((prev) => (prev === seriesName ? null : seriesName));
    };

    const getOpacity = (seriesName: string, defaultFill = 0.1) => {
        if (!selectedSeries) return { stroke: 1, fill: defaultFill };
        return selectedSeries === seriesName
            ? { stroke: 1, fill: defaultFill + 0.2 } // Highlight selected
            : { stroke: 0.1, fill: 0 }; // Dim others
    };

    useEffect(() => {
        const loadData = async () => {
            if (loadingRef.current) return;
            loadingRef.current = true;
            console.log("%c[REPORT] Loading review data...", "color: cyan; font-weight: bold;");
            try {
                // Pass dynamic IDs from navigation state if available
                const response = await getFreshReviewForm(false, stateEmployeeId, stateManagerId);
                console.log("[REPORT] API Response received:", response);

                if (!response) {
                    console.error("[REPORT] No response from API");
                    setLoading(false);
                    return;
                }

                // Handle varied response structures more robustly
                let reviewList: any[] = [];

                // Case 1: Response itself is the array of reviews
                if (Array.isArray(response)) {
                    reviewList = response;
                }
                // Case 2: Response.data is the array
                else if (response.data && Array.isArray(response.data)) {
                    reviewList = response.data;
                }
                // Case 3: Response.data.data is the array (sometimes APIs nest it deeply)
                else if (response.data && response.data.data && Array.isArray(response.data.data)) {
                    reviewList = response.data.data;
                }
                // Case 4: Response.data.review is a single object
                else if (response.data && response.data.review) {
                    reviewList = [response.data.review];
                }
                // Case 5: Response is a single review object
                else if (response._id || response.id) {
                    reviewList = [response];
                }
                // Case 6: Response.data is a single review object
                else if (response.data && (response.data._id || response.data.id)) {
                    reviewList = [response.data];
                }

                // --- LIVE PROGRESS SYNC ---
                // Always fetch source OKRs to ensure we have the most up-to-date progress values
                // Fetch in parallel or sequence, but we need them for both fallback and sync
                console.log("%c[REPORT] Fetching live OKRs...", "color: orange;");
                const sourceOkrs = await fetchEmployeeOKRs(stateEmployeeId, stateManagerId);

                let reviewObj: any = null;

                if (reviewList.length > 0) {
                    // Sort by most recently updated/created
                    reviewList.sort((a, b) => {
                        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                        return dateB - dateA;
                    });
                    reviewObj = reviewList[0];
                    console.log("[REPORT] Selected Review Object ID:", reviewObj?._id || reviewObj?.id);
                } else if (sourceOkrs && sourceOkrs.length > 0) {
                    // SYNTHETIC FALLBACK
                    console.warn("[REPORT] No Review Form found. Generating Synthetic Report from OKRs.");
                    reviewObj = {
                        _id: 'synthetic-' + Date.now(),
                        employeeFullName: stateEmployeeName || 'Employee',
                        managerName: stateManagerName || 'Manager',
                        createdAt: new Date().toISOString(),
                        status: 'Draft',
                        goals: [],
                        competencies: []
                    };

                    // Generate Default Competencies Structure
                    const competencyOrder = ["Ownership & Accountability", "Professionalism", "Customer Focus", "Leadership", "Collaboration"];
                    reviewObj.competencies = competencyOrder.flatMap(name => [
                        { competencyName: name, title: name, type: 'employee', Feedback: 0, Comments: '' },
                        { competencyName: name, title: name, type: 'manager', Feedback: 0, Comments: '' }
                    ]);
                } else {
                    console.error("[REPORT] No Review Form AND No OKRs found. Cannot generate report.");
                    setLoading(false);
                    return;
                }

                if (reviewObj && sourceOkrs && sourceOkrs.length > 0) {
                    const existingGoals = reviewObj.goals || reviewObj.objectives || reviewObj.okrs || [];

                    if (existingGoals.length === 0) {
                        // Case 1: No goals in review form yet, initialize complete structure
                        console.log("[REPORT] Review goals empty. Initializing from source OKRs.");
                        reviewObj.goals = sourceOkrs.map((o: any) => ({
                            _id: o._id || o.id,
                            objective: o.objective || o.title || o.name,
                            weight: o.weight || 0,
                            progressStatus: o.progressStatus || o.progress || 0,
                            employeeRating: 0,
                            managerRating: 0,
                            children: (o.children || o.keyResults || []).map((k: any) => ({
                                _id: k._id || k.id || k.krID,
                                keyResultName: k.keyResultName || k.description || k.title,
                                targetValue: k.target || k.targetValue || 0,
                                actual: k.actual || k.current || 0,
                                unit: k.unit || k.metrics || '',
                                employeeRating: 0,
                                managerRating: 0
                            }))
                        }));
                    } else {
                        // Case 2: Goals exist, update their progress values from live source
                        console.log("[REPORT] Updating existing goals with live progress values.");
                        reviewObj.goals = existingGoals.map((g: any) => {
                            const liveOkr = sourceOkrs.find((so: any) =>
                                String(so._id || so.id || "").trim() === String(g._id || g.id || "").trim() ||
                                (so.objective || "").trim().toLowerCase() === (g.objective || "").trim().toLowerCase()
                            );

                            if (liveOkr) {
                                let updatedG = { ...g };
                                updatedG.progressStatus = liveOkr.progressStatus || liveOkr.progress || g.progressStatus;

                                if (updatedG.children) {
                                    updatedG.children = updatedG.children.map((ch: any) => {
                                        const liveKr = (liveOkr.children || liveOkr.keyResults || []).find((sk: any) =>
                                            String(sk._id || sk.id || "").trim() === String(ch._id || ch.id || ch.krID || "").trim() ||
                                            (sk.keyResultName || sk.description || "").trim().toLowerCase() === (ch.keyResultName || "").trim().toLowerCase()
                                        );
                                        if (liveKr) {
                                            return {
                                                ...ch,
                                                actual: liveKr.actual || liveKr.current || ch.actual,
                                                targetValue: liveKr.target || liveKr.targetValue || ch.targetValue
                                            };
                                        }
                                        return ch;
                                    });
                                }
                                return updatedG;
                            }
                            return g;
                        });
                    }
                    console.log("[REPORT] Progress sync complete.");
                }

                // --- IDENTITY RESOLUTION ---
                // We resolve names by looking at: 
                // 1. The Database Record
                // 2. The Consent Form (state)
                // 3. The API Key Identity (Token)
                try {
                    // Filter out "undefined" or placeholder names from the database
                    const isDbNameValid = (name: string) => name && !name.toLowerCase().includes("undefined") && name.trim() !== "";

                    if (!isDbNameValid(reviewObj.employeeFullName)) {
                        // Priority 2: Use matching name from Consent Form
                        if (stateEmployeeName) {
                            console.log("[REPORT] Using Employee name from Consent Form:", stateEmployeeName);
                            reviewObj.employeeFullName = stateEmployeeName;
                        } else {
                            // Priority 3: Fallback to token but skip "Super Admin"
                            const token = import.meta.env.VITE_EMPLOYEE_API_KEY;
                            if (token) {
                                const payload = JSON.parse(atob(token.split('.')[1]));
                                if (payload.name && payload.name !== "Super Admin") {
                                    reviewObj.employeeFullName = payload.name;
                                }
                            }
                        }
                    }

                    // Resolve Manager name
                    // If the Manager API key matches Madhavi's ID, we force it to ensure accuracy
                    const managerUrl = import.meta.env.VITE_MANAGER_REVIEW_FORM_API_URL || "";
                    if (managerUrl.includes("68e49939df33a7c9177aaf03")) {
                        console.log("[REPORT] Forcing Manager: Madhavi peddireddy");
                        reviewObj.managerName = "Madhavi peddireddy";
                    } else if (!isDbNameValid(reviewObj.managerName)) {
                        if (stateManagerName) {
                            reviewObj.managerName = stateManagerName;
                        }
                    }
                } catch (e) {
                    console.warn("[REPORT] Identity resolution failed", e);
                }

                console.log("[REPORT] Final Review Data for state:", reviewObj);
                setReviewData(reviewObj);
            } catch (error) {
                console.error('[REPORT] Error loading data:', error);
            } finally {
                setLoading(false);
                loadingRef.current = false;
            }
        };

        loadData();

        const handleUpdate = () => {
            console.log("%c[REPORT] Dynamic update event received! Fetching fresh data...", "color: lime; font-weight: bold;");
            loadData();
        };

        window.addEventListener('review-data-updated', handleUpdate);
        return () => window.removeEventListener('review-data-updated', handleUpdate);
    }, []);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfbf9] p-8">
                <div className="relative mb-8">
                    {/* Ripple Effect */}
                    <div className="absolute inset-0 rounded-full bg-[#8da356]/20 animate-ping" style={{ animationDuration: '3s' }}></div>

                    {/* Main Card */}
                    <div className="bg-white h-24 w-24 flex items-center justify-center rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.08)] border border-gray-100 relative z-10 animate-bounce" style={{ animationDuration: '2s' }}>
                        <img src={logoImage} alt="Tara" className="h-12 w-auto" />
                    </div>
                </div>

                <div className="space-y-3 text-center">
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Finalizing Report</h2>
                    <div className="flex items-center gap-2 justify-center text-sm text-[#8da356] font-bold italic">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Rendering your data...
                    </div>
                </div>

                <div className="mt-8 w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#8da356] animate-[shimmer_2s_infinite] w-full" style={{ background: 'linear-gradient(90deg, #f3f4f6 0%, #8da356 50%, #f3f4f6 100%)', backgroundSize: '200% 100%' }}></div>
                </div>
            </div>
        );
    }

    if (!reviewData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfbf9] p-4 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">No Report Found</h2>
                <p className="text-muted-foreground mb-6">We couldn't find any performance review data for this session.</p>
                <Button onClick={() => navigate('/')} variant="outline">Go Back</Button>
            </div>
        );
    }

    // Process OKRs for OKRTable
    const okrs = (reviewData.goals || reviewData.objectives || reviewData.okrs || []).map((goal: any) => {
        const krs = (goal.children || goal.keyResults || goal.key_results || []).map((kr: any) => {
            const target = parseFloat(kr.targetValue || kr.target || '0');
            const current = parseFloat(kr.actual || kr.current || '0');
            // Calculate KR progress: (Current / Target) * 100
            let krProgress = target > 0 ? (current / target) * 100 : 0;
            // Cap at 100% and ensure non-negative
            krProgress = Math.min(100, Math.max(0, krProgress));

            return {
                id: kr._id || kr.id || Math.random().toString(36).substr(2, 9),
                description: kr.keyResultName || kr.okrName || kr.description || kr.title || kr.name || 'No KR Description',
                target: String(target),
                current: String(current),
                progress: krProgress,
                metrics: String(kr.unit || kr.uom || ''),
                employeeRating: !isNaN(parseFloat(kr.employeeRating)) ? Math.round(parseFloat(kr.employeeRating)) : 0,
                managerRating: !isNaN(parseFloat(kr.managerRating)) ? Math.round(parseFloat(kr.managerRating)) : 0
            };
        });

        // Calculate Objective Progress as Average of KR progress
        const avgProgress = krs.length > 0
            ? krs.reduce((acc, kr) => acc + kr.progress, 0) / krs.length
            : (goal.progressStatus || goal.progress || 0);

        return {
            id: goal._id || goal.id || Math.random().toString(36).substr(2, 9),
            objective: goal.objective || goal.okrName || goal.title || goal.name || goal.goalName || 'No Objective Title',
            weight: goal.weight || 0,
            dueDate: goal.dueDate || '',
            progress: Number(avgProgress.toFixed(2)),
            // Strictly check for numeric ratings
            employeeRating: !isNaN(parseFloat(goal.employeeRating)) ? Math.round(parseFloat(goal.employeeRating)) : 0,
            managerRating: !isNaN(parseFloat(goal.managerRating)) ? Math.round(parseFloat(goal.managerRating)) : 0,
            keyResults: krs
        };
    });

    // Process Competencies for Table and Charts
    const competencies = reviewData.competencies || [];
    const competencyOrder = ["Ownership & Accountability", "Professionalism", "Customer Focus", "Leadership", "Collaboration"];

    const competencyData = competencyOrder.map(name => {
        const selfComp = competencies.find((c: any) => c.type === 'employee' && (c.competencyName === name || c.title === name));
        const mgrComp = competencies.find((c: any) => c.type === 'manager' && (c.competencyName === name || c.title === name));
        const selfScore = !isNaN(parseFloat(selfComp?.Feedback)) ? Math.round(parseFloat(selfComp.Feedback)) : 0;
        const mgrScore = !isNaN(parseFloat(mgrComp?.Feedback)) ? Math.round(parseFloat(mgrComp.Feedback)) : 0;
        return {
            subject: name,
            self: selfScore,
            manager: mgrScore,
            average: (selfScore + mgrScore) / 2,
            fullMark: 5,
            selfComment: selfComp?.Comments || selfComp?.comments || '',
            managerComment: mgrComp?.Comments || mgrComp?.comments || ''
        };
    });

    const getSentiment = (rating: number) => {
        if (rating >= 4.5) return { label: "EXCELLENT", emoji: "🤩", color: "bg-green-500", lightColor: "bg-green-500/80", textStyle: "Excellent" };
        if (rating >= 3.5) return { label: "GOOD", emoji: "🙂", color: "bg-[#8da356]", lightColor: "bg-[#8da356]/80", textStyle: "Good" };
        if (rating >= 2.5) return { label: "NEUTRAL", emoji: "😐", color: "bg-yellow-500", lightColor: "bg-yellow-500/80", textStyle: "Neutral" };
        if (rating >= 1.5) return { label: "POOR", emoji: "🙁", color: "bg-orange-500", lightColor: "bg-orange-500/80", textStyle: "Poor" };
        return { label: "CRITICAL", emoji: "😞", color: "bg-red-500", lightColor: "bg-red-500/80", textStyle: "Critical" };
    };

    // --- Calculation Logic for Tooltips ---
    const calculateDetailedStats = () => {
        const empOkrRatings: number[] = [];
        const mgrOkrRatings: number[] = [];
        const empCompRatings: number[] = [];
        const mgrCompRatings: number[] = [];
        const achievementBreakdown: { name: string; progress: number; weight: number; contribution: number }[] = [];
        let calculatedTotalAch = 0;

        // 1. Objectives & KRs
        okrs.forEach(okr => {
            if (okr.employeeRating > 0) empOkrRatings.push(Number(okr.employeeRating));
            if (okr.managerRating > 0) mgrOkrRatings.push(Number(okr.managerRating));

            // Achievement
            const contribution = (Number(okr.progress) * Number(okr.weight)) / 100;
            calculatedTotalAch += contribution;
            achievementBreakdown.push({
                name: okr.objective,
                progress: Number(okr.progress),
                weight: Number(okr.weight),
                contribution: Number(contribution.toFixed(2))
            });

            okr.keyResults.forEach(kr => {
                if (kr.employeeRating > 0) empOkrRatings.push(Number(kr.employeeRating));
                if (kr.managerRating > 0) mgrOkrRatings.push(Number(kr.managerRating));
            });
        });

        // 2. Competencies
        competencyData.forEach(comp => {
            if (comp.self > 0) empCompRatings.push(Number(comp.self));
            if (comp.manager > 0) mgrCompRatings.push(Number(comp.manager));
        });

        const empOkrAvg = empOkrRatings.length ? empOkrRatings.reduce((a, b) => a + b, 0) / empOkrRatings.length : 0;
        const mgrOkrAvg = mgrOkrRatings.length ? mgrOkrRatings.reduce((a, b) => a + b, 0) / mgrOkrRatings.length : 0;
        // Combined OKR is avg of both roles
        const okrCombined = (empOkrAvg > 0 && mgrOkrAvg > 0) ? (empOkrAvg + mgrOkrAvg) / 2 : (empOkrAvg + mgrOkrAvg);

        const empCompAvg = empCompRatings.length ? empCompRatings.reduce((a, b) => a + b, 0) / empCompRatings.length : 0;
        const mgrCompAvg = mgrCompRatings.length ? mgrCompRatings.reduce((a, b) => a + b, 0) / mgrCompRatings.length : 0;
        // Combined Competency is avg of both roles
        const compCombined = (empCompAvg > 0 && mgrCompAvg > 0) ? (empCompAvg + mgrCompAvg) / 2 : (empCompAvg + mgrCompAvg);

        return {
            empOkrAvg: Number(empOkrAvg.toFixed(2)),
            mgrOkrAvg: Number(mgrOkrAvg.toFixed(2)),
            okrCombined: Number(okrCombined.toFixed(2)),
            empCompAvg: Number(empCompAvg.toFixed(2)),
            mgrCompAvg: Number(mgrCompAvg.toFixed(2)),
            compCombined: Number(compCombined.toFixed(2)),
            achievementBreakdown,
            totalAchievement: Number(calculatedTotalAch.toFixed(2))
        };
    };

    const stats = calculateDetailedStats();

    const calculatedOverallRating = Number(((stats.okrCombined * 0.6) + (stats.compCombined * 0.4)).toFixed(2));
    // Use calculated rating if available, fallback to stored rating only if calculation yields 0 (and stored is not).
    // Actually, prefer calculated generally as it's real-time based on items.
    const ratingValue = calculatedOverallRating > 0 ? calculatedOverallRating : parseFloat(reviewData.overallRating || '0');

    const sentiment = getSentiment(ratingValue);

    return (
        <div className="min-h-screen bg-gray-50/50 pb-12 print:bg-white print:pb-0" >
            {/* Nav Header */}
            < header className="sticky top-0 z-30 w-full border-b bg-white/80 backdrop-blur print:hidden" >
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Session
                    </Button>
                    <div className="flex items-center gap-3">
                        <img src={logoImage} alt="Logo" className="h-[60px] w-auto" />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                            <Printer className="h-4 w-4" />
                            Print Report
                        </Button>
                    </div>
                </div>
            </header >

            <main className="container mx-auto px-4 py-8 space-y-8 max-w-6xl print:space-y-0">
                {/* Print-only Fixed Header (Repeats on every page) */}
                <div className="hidden print:flex fixed top-0 left-0 w-full z-50 bg-white justify-between items-center px-4 py-2 h-[90px] border-b border-gray-100">
                    <img src={logoImage} alt="TalentSpotify" className="h-[72px] w-auto" />
                    <div className="text-right text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                        <p>Performance Review Report</p>
                        <p>{(callStartTime || reviewData.createdAt) ? new Date(callStartTime || reviewData.createdAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        }) : ''}</p>
                    </div>
                </div>

                {/* Spacer (for first page visual offset if needed, though margins handle most) */}
                <div className="hidden print:block h-[100px]"></div>

                {/* Feedback Report Contents - Moved to Top for Print */}
                <Card className="hidden print:block p-10 bg-white border-none shadow-sm print:pt-[120px] print:mt-0 shadow-none">
                    <h2 className="text-3xl font-bold text-gray-900 mb-8 tracking-tight">Feedback Report Contents</h2>
                    <div className="space-y-0">
                        {[
                            { id: '01', title: 'Overview of Participant & Responses', targetId: 'overview' },
                            { id: '02', title: "OKR's Rating and Overall Rating", targetId: 'okr-rating' },
                            { id: '03', title: 'Competency Overview and Gaps', targetId: 'competency-gaps' },
                            { id: '04', title: 'Key Takeaways', targetId: 'key-takeaways' },
                            { id: '05', title: 'Highest Rated Competencies and Areas To Improve', targetId: 'competency-table' },
                            { id: '06', title: 'Feedback Summary', targetId: 'feedback-summary' },
                            { id: '07', title: 'The Way Forward', targetId: 'way-forward' }
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-center py-5 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                                <span className="w-24 text-gray-900 font-medium text-lg">{item.id}</span>
                                <button onClick={() => scrollToSection(item.targetId || '')} className="text-gray-700 text-lg hover:text-[#7a8f4b] text-left">
                                    {item.title}
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="print:break-after-page"></div>

                {/* Report Header */}
                <Card className="p-8 border-none shadow-sm bg-white overflow-hidden relative print:pt-[120px] print:mt-0 shadow-none" id="overview">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none print:top-[100px]">
                        <ClipboardList size={120} />
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8da356]/10 text-[#7a8f4b] text-xs font-bold uppercase tracking-wider">
                                Performance Review Report
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
                                {reviewData.employeeFullName || 'Employee Name'}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-700">Manager:</span>
                                    {(() => {
                                        const possibleNames = [
                                            reviewData.managerName,
                                            reviewData.managerFullName,
                                            reviewData.reportingManager,
                                            reviewData.reportingManagerName,
                                            reviewData.manager?.name
                                        ];
                                        const validName = possibleNames.find(n => n && typeof n === 'string' && n.trim() !== '' && n.trim() !== 'Manager Name');
                                        return validName || 'Manager Name';
                                    })()}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-700">Period:</span>
                                    {reviewData.reviewCycle || 'Annual Review 2025'}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-400" />
                                    <span className="font-semibold text-gray-700">Generated:</span>
                                    {(callStartTime || reviewData.createdAt) ? new Date(callStartTime || reviewData.createdAt).toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                    }) : ''}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <TooltipProvider>
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div className="text-center p-4 bg-gray-50 rounded-2xl border border-gray-100 min-w-[120px] cursor-help transition-colors hover:bg-gray-100">
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Overall Rating</p>
                                                <Info className="h-3 w-3 text-gray-400" />
                                            </div>
                                            <p className="text-4xl font-black text-[#7a8f4b]">{ratingValue.toFixed(2)}</p>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-white border text-gray-700 shadow-xl p-4 max-w-[300px]">
                                        <div className="space-y-3">
                                            <div>
                                                <p className="font-bold text-xs mb-1 text-gray-900 border-b pb-1">Calculation Formula</p>
                                                <p className="text-xs font-mono text-gray-600 mt-1">(OKR Avg × 60%) + (Comp Avg × 40%)</p>
                                            </div>
                                            <div>
                                                <p className="font-bold text-xs mb-1 text-gray-900 border-b pb-1">Component Averages</p>
                                                <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs mt-1">
                                                    <span className="text-gray-500">OKR Combined:</span>
                                                    <span className="font-mono">{stats.okrCombined}</span>
                                                    <span className="text-gray-500 italic pl-2 text-[10px]">- Emp: {stats.empOkrAvg}, Mgr: {stats.mgrOkrAvg}</span>
                                                    <br />
                                                    <span className="text-gray-500">Comp Combined:</span>
                                                    <span className="font-mono">{stats.compCombined}</span>
                                                    <span className="text-gray-500 italic pl-2 text-[10px]">- Emp: {stats.empCompAvg}, Mgr: {stats.mgrCompAvg}</span>
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-dashed">
                                                <p className="text-xs font-mono text-gray-800">
                                                    ({stats.okrCombined} × 0.6) + ({stats.compCombined} × 0.4) = <span className="font-bold text-[#7a8f4b]">{ratingValue.toFixed(2)}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </TooltipContent>
                                </UITooltip>

                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div className="text-center p-4 bg-gray-50 rounded-2xl border border-gray-100 min-w-[120px] cursor-help transition-colors hover:bg-gray-100">
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Achievement</p>
                                                <Info className="h-3 w-3 text-gray-400" />
                                            </div>
                                            <p className="text-4xl font-black text-pink-500">{stats.totalAchievement || '0'}%</p>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-white border text-gray-700 shadow-xl p-4 max-w-[320px]">
                                        <div className="space-y-3">
                                            <div>
                                                <p className="font-bold text-xs mb-1 text-gray-900 border-b pb-1">Calculation Formula</p>
                                                <p className="text-xs font-mono text-gray-600 mt-1">Sum of (Objective Progress × Weight)</p>
                                            </div>
                                            <div>
                                                <p className="font-bold text-xs mb-1 text-gray-900 border-b pb-1">Breakdown</p>
                                                <div className="space-y-1 mt-1">
                                                    {stats.achievementBreakdown.map((item, i) => (
                                                        <div key={i} className="flex justify-between items-center text-xs">
                                                            <span className="text-gray-500 truncate max-w-[150px]" title={item.name}>{item.name.substring(0, 20)}{item.name.length > 20 ? '...' : ''}</span>
                                                            <span className="font-mono text-gray-700">
                                                                {item.progress}% × {item.weight}% = <b>{item.contribution}</b>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-dashed flex justify-between items-center">
                                                <span className="text-xs font-bold text-gray-900">Total Achievement:</span>
                                                <span className="text-xs font-mono font-bold text-pink-500">{stats.totalAchievement}%</span>
                                            </div>
                                        </div>
                                    </TooltipContent>
                                </UITooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                </Card>

                {/* OKR Section */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <Target className="h-5 w-5 text-[#7a8f4b]" />
                        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Objectives & Key Results</h2>
                    </div>
                    <OKRTable okrs={okrs} />
                </section>

                <div className="print:break-after-page" id="competency-gaps"></div>

                {/* Competency Overview & Gaps Section */}
                <section className="space-y-6 print:pt-[120px] print:space-y-1">
                    <div className="flex flex-col gap-1 px-1 print:mb-2">
                        <h2 className="text-2xl font-bold text-gray-900 leading-tight print:text-lg">Competency Overview & Gaps</h2>
                        <h3 className="text-lg font-bold text-gray-700 print:text-sm">Overall Competency Overview</h3>
                    </div>

                    <div className="bg-white rounded-2xl p-8 print:p-0 print:rounded-none shadow-sm space-y-8 border-none print:space-y-2">
                        <p className="text-sm text-gray-600 leading-relaxed max-w-4xl">
                            The Competency Comparison Overview breaks down your assessment results based on your responses against your assessment
                            results based on your Manager's responses and allows for an easy gap analysis. The N signifies the scores across which the
                            responses for each competency are graded.
                        </p>

                        <div className="flex flex-col items-center justify-center py-8 w-full">
                            {/* Radar Chart 1: Self vs Manager */}
                            <div className="w-full max-w-2xl flex flex-col items-center">
                                <div className="w-full h-[400px] print:h-[320px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={competencyData}>
                                            <PolarGrid stroke="#e5e7eb" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 5]} axisLine={false} tick={false} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                                            />
                                            <Radar
                                                name="Self Score"
                                                dataKey="self"
                                                stroke="#8da356"
                                                fill="#8da356"
                                                fillOpacity={getOpacity('Self Score').fill}
                                                strokeOpacity={getOpacity('Self Score').stroke}
                                                // Make it interactive
                                                cursor="pointer"
                                            />
                                            <Radar
                                                name="Manager Score"
                                                dataKey="manager"
                                                stroke="#f472b6"
                                                fill="#f472b6"
                                                fillOpacity={getOpacity('Manager Score').fill}
                                                strokeOpacity={getOpacity('Manager Score').stroke}
                                                cursor="pointer"
                                            />
                                            <RechartsLegend
                                                verticalAlign="top"
                                                height={36}
                                                onClick={handleLegendClick}
                                                wrapperStyle={{ cursor: 'pointer' }}
                                            />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 pt-4 print:pt-0 print:space-y-2">
                            <div className="flex flex-wrap gap-2 text-sm font-bold text-gray-800">
                                {competencyOrder.map((name, i) => (
                                    <span key={i}>{name}{i < competencyOrder.length - 1 ? " , " : "."}</span>
                                ))}
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed italic border-l-4 border-[#8da356] pl-4">
                                Assessing these significant gaps will promote a constructive dialogue around self-awareness and perception of your Manager,
                                which will give you clarity and help take a positive action for your performance.
                            </p>
                        </div>
                    </div>
                </section>

                <div className="hidden print:block h-[50px]"></div>

                {/* Competency Table Section */}
                <section className="space-y-4 print:space-y-2 print:break-before-page print:pt-[120px]">
                    <div className="flex items-center gap-2 px-1">
                        <BarChart3 className="h-5 w-5 text-pink-500" />
                        <h2 className="text-xl font-bold text-gray-800 tracking-tight print:text-lg">Competency Assessment Table</h2>
                    </div>
                    <Card className="p-6 bg-white border-none shadow-sm">
                        <CompetencyTable data={competencyData.map(c => ({
                            name: c.subject,
                            self: c.self,
                            manager: c.manager,
                            average: c.average
                        }))} />
                    </Card>
                </section>

                <div id="individual-competency"></div>

                {/* Individual Competency Charts Section */}
                <section className="space-y-8 print:break-before-page print:pt-[120px] print:space-y-0">
                    <div className="flex items-center gap-2 px-1 pt-4 print:mb-8">
                        <BarChart3 className="h-5 w-5 text-[#8da356]" />
                        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Individual Competency Performance</h2>
                    </div>

                    {competencyData.map((comp, idx) => (
                        <div key={idx} className="print:break-after-page">
                            {idx > 0 && <div className="hidden print:block h-[120px]"></div>}
                            <Card className="p-8 bg-white border-none shadow-sm">
                                <h3 className="text-2xl font-black text-gray-900 mb-12">{comp.subject}</h3>

                                <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-8 print:grid-cols-[180px_1fr] print:gap-4">
                                    {/* Legend Labels on Left */}
                                    <div className="flex flex-col justify-between py-10 space-y-4 print:py-4 print:space-y-2">
                                        <div className="flex items-center justify-between text-sm font-medium text-gray-500">
                                            <span>Exceptional</span>
                                            <span className="bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-bold">5</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm font-medium text-gray-500">
                                            <span>Highly Satisfactory</span>
                                            <span className="bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-bold">4</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm font-medium text-gray-500">
                                            <span>Satisfactory</span>
                                            <span className="bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-bold">3</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm font-medium text-gray-500">
                                            <span>Unsatisfactory</span>
                                            <span className="bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-bold">2</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm font-medium text-gray-500">
                                            <span>Highly Unsatisfactory</span>
                                            <span className="bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-bold">1</span>
                                        </div>
                                    </div>

                                    {/* Bar Chart */}
                                    <div className="h-[400px] w-full print:h-[320px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={[
                                                    { name: 'Self Present & Prev Feedback', value: comp.self },
                                                    { name: 'Manager Present & Prev Feedback', value: comp.manager }
                                                ]}
                                                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                            >
                                                <CartesianGrid vertical={false} strokeDasharray="0" stroke="#f0f0f0" />
                                                <XAxis
                                                    dataKey="name"
                                                    axisLine={{ stroke: '#e5e7eb' }}
                                                    tickLine={false}
                                                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                                                />
                                                <YAxis
                                                    domain={[0, 5]}
                                                    ticks={[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: 'transparent' }}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                                                />
                                                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={80}>
                                                    {[0, 1].map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill="#0000ff" />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Comments Section below chart */}
                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-gray-50 print:mt-4 print:pt-4 print:grid-cols-1">
                                    <div className="space-y-3">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8da356]/10 text-[#7a8f4b] text-[10px] font-bold uppercase tracking-wider">
                                            Self Reflection
                                        </div>
                                        <p className="text-gray-600 text-base leading-relaxed italic pl-1">
                                            "{comp.selfComment}"
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-50 text-pink-500 text-[10px] font-bold uppercase tracking-wider">
                                            Manager Feedback
                                        </div>
                                        <p className="text-gray-600 text-base leading-relaxed italic pl-1">
                                            "{comp.managerComment}"
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    ))}
                </section>

                {/* Feedback Summary Section */}
                <section className="space-y-6 pt-8 print:pt-[120px]" id="feedback-summary">
                    <div className="border-t-4 border-[#8da356] w-24 mb-4"></div>
                    <div className="flex flex-col gap-1 px-1">
                        <h2 className="text-3xl font-black text-gray-900 leading-tight">Feedback Summary</h2>
                    </div>

                    <Card className="p-10 bg-white border-none shadow-sm space-y-10 pt-10">

                        <div className="space-y-12">
                            {/* Employee Feedback Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                                    <div className="bg-[#8da356] h-6 w-1 rounded-full"></div>
                                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider">Employee Feedback</h3>
                                </div>

                                <div className="grid gap-6 pl-4">
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">What Is Your Key Accomplishments In The Last Quarter?</h4>
                                        <p className="text-sm text-gray-700 bg-gray-50/50 p-5 rounded-2xl border border-gray-100 leading-relaxed shadow-sm">
                                            {reviewData.overallComments?.cm1 || reviewData.overalComments?.cm1 || ""}
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">What Is Your Plan For The Next Quarter?</h4>
                                        <p className="text-sm text-gray-700 bg-gray-50/50 p-5 rounded-2xl border border-gray-100 leading-relaxed shadow-sm">
                                            {reviewData.overallComments?.cm2 || reviewData.overalComments?.cm2 || ""}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Manager Feedback Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                                    <div className="bg-pink-500 h-6 w-1 rounded-full"></div>
                                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider">Manager Feedback</h3>
                                </div>

                                <div className="grid gap-6 pl-4">
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Overall Comments</h4>
                                        <p className="text-sm text-gray-700 bg-gray-50/50 p-5 rounded-2xl border border-gray-100 leading-relaxed shadow-sm">
                                            {reviewData.overallComments?.cm3 || reviewData.overalComments?.cm3 || reviewData.managerOverallComments || ""}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 pt-6 border-t border-gray-100">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-wider">Sentiment Analysis</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Based on the feedback from your Managers, we performed an AI-driven Sentiment Analysis on their responses to give us an overall
                                indication of their perception of your job-related performance for the last quarter. The analysis results show that your Manager's sentiment
                                for your job-related performance was <span className="font-black uppercase">{sentiment.label}</span>
                            </p>

                            <div className="mt-8 overflow-hidden rounded-xl border border-gray-100 shadow-sm">
                                <div className={`${sentiment.lightColor} text-white py-3 px-6 text-center font-bold text-sm tracking-wider uppercase`}>
                                    {sentiment.textStyle}
                                </div>
                                <div className="bg-[#fcfbf9] py-8 flex flex-col items-center justify-center gap-4">
                                    <div className="text-6xl">{sentiment.emoji}</div>
                                    <div className="h-1 w-16 bg-gray-200 rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Discussion Transcript removed as requested */}

                {/* Footer */}
                <footer className="text-center pt-8 border-t border-gray-100 text-xs text-muted-foreground print:pt-4">
                    <p>© 2026 TalentSpotify Performance Management System • Generated by Tara AI</p>
                </footer>
            </main>
        </div >
    );
};

export default Report;
