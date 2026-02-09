import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, PhoneOff, Download, Send, Bot, Sparkles, Loader2, Target, CheckCircle2, Paperclip, Link as LinkIcon, X, Heart, Mic, MicOff, BarChart3, ClipboardList, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useVapi } from '@/hooks/useVapi';
import logoImage from '@/assets/talentspotify-logo.png';
import { fetchAllEmployees, getFullName, Employee } from '@/services/employeeService';

interface Participant {
    name: string;
    id?: string;
    role: 'employee' | 'manager';
}

export const VapiVoiceInterface = () => {
    const navigate = useNavigate();
    const [textInput, setTextInput] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const [isConnecting, setIsConnecting] = useState(false);
    const [hasStartedCall, setHasStartedCall] = useState(false);
    const [attachmentLink, setAttachmentLink] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [tempLink, setTempLink] = useState('');
    const [showThankYou, setShowThankYou] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [generatingStep, setGeneratingStep] = useState(0);

    // Consent dialog state
    const [showConsentDialog, setShowConsentDialog] = useState(false);
    const [managerConsent, setManagerConsent] = useState(false);
    const [employeeConsent, setEmployeeConsent] = useState(false);

    // User Identity State
    const [employeeName, setEmployeeName] = useState('');
    const [managerName, setManagerName] = useState('');

    // Auth / Email State
    const [showEmailDialog, setShowEmailDialog] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
    const [employeeId, setEmployeeId] = useState('');
    const [managerId, setManagerId] = useState('');

    // Use Vapi hook
    const {
        isCallActive,
        isSpeaking,
        messages,
        transcript,
        error,
        currentSpeaker,
        beingAddressed,
        participantNames,
        callStartTime,
        startCall,
        stopCall,
        sendMessage,
        setSpeaker,
        toggleMute: vapiToggleMute,
        isMuted
    } = useVapi();

    // Names are now manually entered or updated by user
    useEffect(() => {
        // We no longer auto-prefill names to ensure the user sees the placeholders 
        // as per the latest requirement. The logic for fetching is removed.
    }, []);

    const handleStartCall = async () => {
        // Start the flow with Email Validation
        setShowEmailDialog(true);
    };

    const handleEmailSubmit = async () => {
        if (!emailInput.trim()) {
            toast({
                title: "Email Required",
                description: "Please enter your email to proceed.",
                variant: "destructive"
            });
            return;
        }

        setIsVerifyingEmail(true);
        try {
            // Fetch ALL Employees
            const allEmployees = await fetchAllEmployees();

            // Filter by Email (case insensitive) within nested structure
            // User Spec: contactInformation.email OR contactInformation.workEmail matches typed email
            const targetEmployee = allEmployees.find(emp => {
                const contact = (emp as any).contactInformation;
                if (!contact) return false;
                const workEmail = contact.workEmail || contact.email;
                return workEmail && String(workEmail).toLowerCase().trim() === emailInput.toLowerCase().trim();
            });

            if (!targetEmployee) {
                toast({
                    title: "Employee Not Found",
                    description: "No employee found for the provided email.",
                    variant: "destructive"
                });
                setIsVerifyingEmail(false);
                return;
            }

            // Extract Employee Data from Nested Structures
            // Name = personalInformation.firstName + middleName + lastName
            const personalInfo = (targetEmployee as any).personalInformation || {};
            const empName = [personalInfo.firstName, personalInfo.middleName, personalInfo.lastName]
                .filter(Boolean)
                .join(' ');

            // Employee ID = employmentInformation.employeeNumber
            const employmentInfo = (targetEmployee as any).employmentInformation || {};

            // Using _id for internal API calls as previously established, but logging employeeNumber as user requested extraction
            const empId = targetEmployee._id;
            const empNumber = employmentInfo.employeeNumber;
            const lineManagerId = targetEmployee.lineManager; // Assuming this logic remains at root or needs adjustment if also nested? 
            // User prompt didn't specify where lineManagerID lives, but usually it's root or employmentInfo. 
            // Checking previous context, user said "Extract... Line Manager ID (lineManager)". Only name/id changed paths.
            // Let's assume lineManager is still on root or check employmentInfo fallback.
            const managerIdRef = targetEmployee.lineManager || employmentInfo.lineNumberManager || employmentInfo.lineManager;

            // Search Manager by _id
            let managerNameFound = '';
            let mgrId = '';

            if (managerIdRef) {
                // Determine if lineManager is an ID string or object, usually string in these APIs
                const manager = allEmployees.find(e => e._id === managerIdRef);
                if (manager) {
                    const mgrPersonalInfo = (manager as any).personalInformation || {};
                    managerNameFound = [mgrPersonalInfo.firstName, mgrPersonalInfo.middleName, mgrPersonalInfo.lastName]
                        .filter(Boolean)
                        .join(' ');
                    mgrId = manager._id;
                } else {
                    console.warn("Manager not found for ID:", managerIdRef);
                    // Fallback or nullable?
                    managerNameFound = "Manager";
                }
            }

            // Update State
            setEmployeeName(empName);
            setManagerName(managerNameFound);
            setEmployeeId(empId); // Using _id for API calls
            setManagerId(mgrId);

            // Close Email Dialog and Show Consent
            setShowEmailDialog(false);
            setShowConsentDialog(true);

        } catch (error) {
            console.error("Email validation failed:", error);
            toast({
                title: "Validation Error",
                description: "Failed to validate email or fetch data.",
                variant: "destructive"
            });
        } finally {
            setIsVerifyingEmail(false);
        }
    };

    const handleConsentSubmit = async () => {
        // Check if both consents are given and names are present
        if (!managerConsent || !employeeConsent) {
            toast({
                title: "Consent Required",
                description: "Both participants must provide consent to proceed.",
                variant: "destructive"
            });
            return;
        }

        if (!managerName.trim() || !employeeName.trim()) {
            toast({
                title: "Information Missing",
                description: "Both Employee and Manager names are required.",
                variant: "destructive"
            });
            return;
        }

        // Close dialog and start call
        setShowConsentDialog(false);
        setIsConnecting(true);
        try {
            // Pass the extracted IDs to startCall
            await startCall(managerName, employeeName, employeeId, managerId);
            setHasStartedCall(true);
        } catch (error) {
            console.error(error);
            setIsConnecting(false);
        }
    };

    const handleStopCall = async () => {
        await stopCall();
        setShowThankYou(true);
    };

    const toggleMute = () => {
        const success = vapiToggleMute();
        if (success) {
            toast({
                title: !isMuted ? "Microphone Muted" : "Microphone Unmuted",
                description: !isMuted ? "Your microphone is muted" : "You can now speak",
            });
        }
    };

    useEffect(() => {
        if (isCallActive) {
            setIsConnecting(false);
            setHasStartedCall(true);
        }
    }, [isCallActive]);

    // Handle redirect after showing thank you
    useEffect(() => {
        if (showThankYou) {
            const timer = setTimeout(() => {
                setShowThankYou(false);
                setHasStartedCall(false);
                setManagerConsent(false);
                setEmployeeConsent(false);
                setEmployeeName('');
                setManagerName('');
            }, 3000); // Show for 3 seconds
            return () => clearTimeout(timer);
        }
    }, [showThankYou]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (error) {
            toast({
                title: "Error",
                description: error,
                variant: "destructive",
            });
        }
    }, [error, toast]);

    const handleTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if ((!textInput.trim() && !attachmentLink) || !isCallActive) return;

        let messageContent = textInput.trim();
        if (attachmentLink) {
            messageContent += `\nAttached Document: ${attachmentLink}`;
        }

        sendMessage(messageContent);
        setTextInput('');
        setAttachmentLink('');
    };

    const handleLinkSubmit = () => {
        if (tempLink) {
            setAttachmentLink(tempLink);
            setShowLinkInput(false);
            setTempLink('');
        }
    };

    const downloadReport = () => {
        const header = `
TalentSpotify Performance Review Report
TalentSpotify Performance Review Report
Generated by Tara, HR Assistant
Date: ${(callStartTime || new Date()).toLocaleDateString()}
Time: ${(callStartTime || new Date()).toLocaleTimeString()}
${'='.repeat(60)}

`;

        const report = header + messages.map(msg => {
            const speakerLabel = msg.speaker || (msg.role === 'assistant' ? 'Tara (HR Assistant)' : 'Participant');
            return `[${msg.timestamp.toLocaleTimeString()}] ${speakerLabel}: ${msg.content}`;
        }).join('\n\n');

        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `talentspotify-review-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
            title: "Performance Review Report Downloaded",
            description: "Your review session has been saved",
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-assistant-bg p-4">
            {/* Link Input Dialog */}
            <Dialog open={showLinkInput} onOpenChange={setShowLinkInput}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Attach Document Link</DialogTitle>
                        <DialogDescription>
                            Paste a URL to a document you want to share in the conversation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Input
                            id="link"
                            placeholder="https://..."
                            value={tempLink}
                            onChange={(e) => setTempLink(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleLinkSubmit();
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowLinkInput(false)}>Cancel</Button>
                        <Button onClick={handleLinkSubmit} disabled={!tempLink.trim()}>Attach</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Email Validation Dialog */}
            <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Enter Your Email</DialogTitle>
                        <DialogDescription>
                            Please enter your work email to verify your identity and retrieve your review details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@company.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleEmailSubmit();
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
                        <Button onClick={handleEmailSubmit} disabled={isVerifyingEmail || !emailInput.trim()}>
                            {isVerifyingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Verify & Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Thank You Card */}
            {showThankYou && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
                    <Card className="w-full max-w-md bg-white shadow-2xl rounded-3xl p-12 flex flex-col items-center space-y-6 border-none animate-in zoom-in duration-500">
                        {/* Heart Icon with Animation */}
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-[#8da356]/20 animate-ping" style={{ animationDuration: '1.5s' }}></div>
                            <div className="bg-[#8da356]/10 h-24 w-24 flex items-center justify-center rounded-full relative z-10">
                                <Heart className="h-12 w-12 text-[#8da356] fill-[#8da356] animate-pulse" />
                            </div>
                        </div>

                        {/* Thank You Message */}
                        <div className="text-center space-y-3">
                            <h2 className="text-3xl font-bold text-[#333]">Thank You!</h2>
                            <p className="text-base text-[#666]">Your performance review session has been completed successfully.</p>
                        </div>

                        {/* Redirect Message */}
                        <div className="flex items-center gap-2 text-sm text-[#888]">
                            <div className="h-2 w-2 rounded-full bg-[#8da356] animate-pulse"></div>
                            <span>Redirecting to home...</span>
                        </div>
                    </Card>
                </div>
            )}

            {/* Consent Dialog */}
            <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
                <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg md:text-2xl font-bold text-center flex items-center justify-center gap-2">
                            <CheckCircle2 className="h-6 w-6 text-primary" />
                            Voice Recording Consent
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm md:text-base mt-4">
                            Before we begin, please review and provide your consent
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Purpose Explanation */}
                        <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                            <h4 className="font-semibold text-foreground">Purpose of This Session</h4>
                            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                                <li>Conduct a structured performance review conversation</li>
                                <li>Record and transcribe the discussion for documentation</li>
                                <li>Generate insights and feedback based on the conversation</li>
                                <li>Create a comprehensive review report for HR records</li>
                            </ul>
                        </div>

                        {/* Participant Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Employee Name</label>
                                <Input
                                    value={employeeName}
                                    onChange={(e) => setEmployeeName(e.target.value)}
                                    className="bg-white"
                                    placeholder="Enter Employee Name"
                                // Make it read-only if it was successfully fetched, but allow manual override if empty (rare)
                                // Actually, let's keep it editable just in case the token name is formal/incorrect
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Manager Name</label>
                                <Input
                                    value={managerName}
                                    onChange={(e) => setManagerName(e.target.value)}
                                    className="bg-white"
                                    placeholder="Enter Manager Name"
                                />
                            </div>
                        </div>

                        {/* Consent Checkboxes */}
                        <div className="space-y-4">
                            <div className="flex items-start space-x-2 md:space-x-3 p-3 md:p-4 bg-accent/5 rounded-lg border border-accent/20">
                                <Checkbox
                                    id="manager-consent"
                                    checked={managerConsent}
                                    onCheckedChange={(checked) => setManagerConsent(checked as boolean)}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <label
                                        htmlFor="manager-consent"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        <span className="font-semibold text-primary">Manager Consent</span>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            I consent to having this performance review session recorded and transcribed. I understand the recording will be used for documentation and HR purposes.
                                        </p>
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-start space-x-2 md:space-x-3 p-3 md:p-4 bg-accent/5 rounded-lg border border-accent/20">
                                <Checkbox
                                    id="employee-consent"
                                    checked={employeeConsent}
                                    onCheckedChange={(checked) => setEmployeeConsent(checked as boolean)}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <label
                                        htmlFor="employee-consent"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        <span className="font-semibold text-accent">Employee Consent</span>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            I consent to having this performance review session recorded and transcribed. I understand the recording will be used for documentation and HR purposes.
                                        </p>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowConsentDialog(false);
                                setManagerConsent(false);
                                setEmployeeConsent(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConsentSubmit}
                            disabled={!managerConsent || !employeeConsent}
                            className="bg-[#8da356] hover:bg-[#7a8f4b]"
                        >
                            {managerConsent && employeeConsent ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Start Session
                                </>
                            ) : (
                                "Provide Consent to Continue"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {!hasStartedCall ? (
                <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#fcfbf9] relative overflow-hidden">
                    {/* Top Left Branding - Hidden on mobile */}
                    <div className="hidden md:flex absolute top-4 left-4 items-center gap-3">
                        <img
                            src={logoImage}
                            alt="TalentSpotify Logo"
                            className="h-8 md:h-10 w-auto"
                        />
                        <span className="text-2xl md:text-3xl font-bold text-[#7a8f4b] tracking-tight">TalentSpotify</span>
                    </div>

                    {/* Center Card */}
                    <Card className="w-full max-w-md bg-white shadow-xl rounded-[2rem] p-6 md:p-10 flex flex-col items-center space-y-6 md:space-y-8 border-none animate-in fade-in zoom-in duration-500 z-10">
                        {/* Logo Card */}
                        <div className="relative mb-4 md:mb-8 animate-bounce" style={{ animationDuration: '3s' }}>
                            {/* Ripple Effect */}
                            <div className="absolute inset-0 rounded-full bg-[#8da356]/20 animate-ping" style={{ animationDuration: '2s' }}></div>

                            {/* Main Card */}
                            <div className="bg-white h-24 w-24 md:h-32 md:w-32 flex items-center justify-center rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.08)] border border-gray-100 relative z-10">
                                <img src={logoImage} alt="Tara" className="h-12 md:h-16 w-auto" />
                            </div>

                            {/* Decorative glow underneath */}
                            <div className="absolute -inset-4 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full blur-xl -z-10 opacity-50"></div>
                        </div>

                        {/* Title & Desc */}
                        <div className="text-center space-y-3">
                            <h1 className="text-xl md:text-2xl font-bold text-[#333] tracking-wider">TARA</h1>
                            <p className="text-xs md:text-sm text-[#888]">Your HR performance review voice assistant</p>
                        </div>

                        {/* Connect Button */}
                        <Button
                            onClick={handleStartCall}
                            disabled={isConnecting}
                            className="w-full h-12 md:h-14 bg-[#8da356] hover:bg-[#7a8f4b] text-white rounded-xl text-base md:text-lg font-medium shadow-md transition-all hover:shadow-lg hover:scale-[1.02] flex items-center justify-center gap-2 md:gap-3"
                        >
                            {isConnecting ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Phone className="h-5 w-5 fill-current" />
                            )}
                            {isConnecting ? "Connecting..." : "Connect with Tara"}
                        </Button>

                        {/* Status */}
                        <div className="flex items-center gap-2 text-xs text-[#888]">
                            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                            <span>Voice assistant ready</span>
                        </div>
                    </Card>

                    {/* Bottom Info Card */}
                    <div className="mt-6 md:mt-8 bg-white rounded-3xl py-3 px-4 md:py-4 md:px-8 w-full max-w-md border border-gray-100 shadow-sm text-center space-y-2 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-semibold text-[#555]">
                            <Target className="h-4 w-4 text-pink-500" />
                            Performance reviews made simple
                        </div>
                        <p className="text-[10px] md:text-xs text-[#888] font-medium">Natural conversation • Instant insights • Personalized feedback</p>
                    </div>
                </div>
            ) : (
                <div className="max-w-[1600px] mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex flex-col items-center justify-center gap-3 bg-card/50 backdrop-blur border border-border p-3 md:p-4 rounded-xl shadow-sm">
                        {/* Branding */}
                        <div className="flex items-center gap-3">
                            <img
                                src={logoImage}
                                alt="TalentSpotify Logo"
                                className="h-10 md:h-16 w-auto"
                            />
                            <div className="text-center md:text-left">
                                <h2 className="text-lg md:text-2xl font-semibold text-foreground">TalentSpotify</h2>
                                <p className="text-xs text-muted-foreground">Performance Review with Tara</p>
                            </div>
                        </div>
                    </div>

                    {/* Responsive Layout: Single column on mobile, 3 columns on desktop */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Left Column: Tara Avatar */}
                        <Card className="p-4 md:p-6 bg-card/50 backdrop-blur border-border h-auto lg:h-[600px] min-h-[300px] flex flex-col items-center justify-center relative overflow-hidden">
                            {/* Animated Tara Avatar */}
                            <div className="relative mb-8">
                                {/* Logo Card - Same as first page */}
                                <div className="relative animate-bounce" style={{ animationDuration: '3s' }}>
                                    {/* Ripple Effect */}
                                    <div className="absolute inset-0 rounded-full bg-[#8da356]/20 animate-ping" style={{ animationDuration: '2s' }}></div>

                                    {/* Main Card */}
                                    <div className="bg-white h-40 w-40 flex items-center justify-center rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.08)] border border-gray-100 relative z-10">
                                        <img src={logoImage} alt="Tara" className="h-20 w-auto" />
                                    </div>

                                    {/* Decorative glow underneath */}
                                    <div className="absolute -inset-4 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full blur-xl -z-10 opacity-50"></div>
                                </div>
                            </div>

                            {/* Title */}
                            <h3 className="text-2xl font-bold text-foreground mb-2">Tara</h3>
                            <p className="text-sm text-muted-foreground mb-6">AI HR Assistant</p>

                            {/* Status Text */}
                            <div className="text-center space-y-4 w-full px-4">
                                {isSpeaking ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 justify-center">
                                            <div className="flex gap-1">
                                                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '200ms' }}></div>
                                                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '400ms' }}></div>
                                            </div>
                                            <span className="text-sm font-medium text-primary">Tara Speaking...</span>
                                        </div>

                                        {beingAddressed && (
                                            <div className="animate-in fade-in zoom-in duration-500 bg-primary/10 border border-primary/20 py-2 px-4 rounded-full inline-flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                                                <span className="text-sm font-bold text-primary">
                                                    Addressing: {beingAddressed === 'Employee' ? employeeName : managerName}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm text-muted-foreground">Listening for response...</p>
                                        {beingAddressed && (
                                            <div className="bg-muted py-2 px-4 rounded-full inline-flex items-center gap-2 border border-border">
                                                <Mic className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm font-medium text-foreground">
                                                    Waiting for: <span className="font-bold text-primary">{beingAddressed === 'Employee' ? employeeName : managerName}</span>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Right Column: Review Transcript */}
                        <Card className="p-3 md:p-4 bg-card/50 backdrop-blur border-border h-auto lg:h-[600px] min-h-[400px] flex flex-col">
                            <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
                                <h3 className="text-xl font-semibold text-foreground">Review Transcript</h3>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={downloadReport}
                                        className="gap-2"
                                        disabled={messages.length === 0}
                                    >
                                        <Download className="h-4 w-4" />
                                        {messages.length > 0 ? "Download" : "Report"}
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => {
                                            setIsGeneratingReport(true);
                                            const steps = [
                                                "Connecting to TalentSpotify Intelligence...",
                                                "Analyzing conversation transcripts...",
                                                "Calculating performance indicators...",
                                                "Synchronizing OKR progress data...",
                                                "Optimizing report visual layout...",
                                                "Generating your performance report..."
                                            ];

                                            let currentStep = 0;
                                            const interval = setInterval(() => {
                                                currentStep++;
                                                if (currentStep < steps.length) {
                                                    setGeneratingStep(currentStep);
                                                } else {
                                                    clearInterval(interval);
                                                    setTimeout(() => {
                                                        navigate('/report', {
                                                            state: {
                                                                messages,
                                                                callStartTime,
                                                                employeeName,
                                                                managerName,
                                                                employeeId,
                                                                managerId
                                                            }
                                                        });
                                                    }, 600);
                                                }
                                            }, 700);
                                        }}
                                        className="gap-2 bg-[#8da356] hover:bg-[#7a8f4b] transition-all duration-300"
                                        disabled={messages.length === 0}
                                    >
                                        <Sparkles className="h-4 w-4" />
                                        Generate Report
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                {messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-4 rounded-lg animate-in fade-in slide-in-from-bottom-2 ${msg.role === 'user'
                                            ? 'bg-secondary text-secondary-foreground ml-8'
                                            : 'bg-assistant-bg text-foreground mr-8'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold text-foreground">
                                                        {msg.speaker || (msg.role === 'user' ? currentSpeaker : 'Tara (HR Assistant)')}
                                                    </p>
                                                    {msg.speaker === 'Employee' && (
                                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold uppercase">Employee</span>
                                                    )}
                                                    {msg.speaker === 'Manager' && (
                                                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold uppercase">Manager</span>
                                                    )}
                                                </div>
                                                <p className="text-base whitespace-pre-wrap">{msg.content || '...'}</p>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {msg.timestamp.toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Live Transcription Preview */}
                                {transcript && (
                                    <div className="p-4 rounded-lg animate-in fade-in slide-in-from-bottom-2 bg-secondary/50 text-secondary-foreground ml-8 border border-dashed border-secondary-foreground/20">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium mb-1 text-muted-foreground flex items-center gap-2">
                                                    {isCallActive ? (
                                                        <>
                                                            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                                                            Speaking...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></span>
                                                            Processing...
                                                        </>
                                                    )}
                                                </p>
                                                <p className="text-base whitespace-pre-wrap">{transcript}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        </Card>

                        {/* Right Column: Voice Controls */}
                        <Card className="p-3 md:p-4 bg-card/50 backdrop-blur border-border h-auto lg:h-[600px] min-h-[400px] flex flex-col items-center justify-between relative overflow-hidden">
                            <h3 className="text-lg md:text-xl font-semibold text-foreground text-center">Voice Control</h3>

                            {/* Center: Call Control */}
                            <div className="flex-1 flex flex-col items-center justify-center space-y-4 md:space-y-8 py-4">
                                <p className="text-primary font-medium text-xs md:text-sm">Call Active</p>

                                {/* Control Buttons */}
                                <div className="flex gap-4 md:gap-6 items-center">
                                    {/* Mute/Unmute Button */}
                                    <div className="flex flex-col items-center gap-2">
                                        <Button
                                            size="lg"
                                            onClick={toggleMute}
                                            variant="outline"
                                            className={`h-12 w-12 md:h-16 md:w-16 rounded-full transition-all shadow-md ${isMuted
                                                ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600'
                                                : 'bg-[#8da356] hover:bg-[#7a8f4b] text-white border-[#8da356]'
                                                }`}
                                        >
                                            {isMuted ? (
                                                <MicOff className="h-4 w-4 md:h-6 md:w-6" />
                                            ) : (
                                                <Mic className="h-4 w-4 md:h-6 md:w-6" />
                                            )}
                                        </Button>
                                        <span className="text-xs text-muted-foreground font-medium">
                                            {isMuted ? 'Unmute' : 'Mute'}
                                        </span>
                                    </div>

                                    {/* End Call Button */}
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="relative">
                                            {/* Pulsing rings */}
                                            <div className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" style={{ animationDuration: '1.5s' }}></div>
                                            <div className="absolute inset-0 rounded-full bg-destructive/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>

                                            <Button
                                                size="lg"
                                                onClick={handleStopCall}
                                                className="h-12 w-12 md:h-16 md:w-16 rounded-full transition-all relative z-10 bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/50"
                                            >
                                                <PhoneOff className="h-4 w-4 md:h-6 md:w-6" />
                                            </Button>
                                        </div>
                                        <span className="text-xs text-muted-foreground font-medium">End Call</span>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom: Input Area */}
                            <div className="w-full pt-4 border-t border-border/50 space-y-3">
                                {attachmentLink && (
                                    <div className="flex items-center gap-2 text-xs bg-accent/10 p-2 rounded text-accent-foreground animate-in fade-in slide-in-from-bottom-1">
                                        <LinkIcon className="h-3 w-3" />
                                        <span className="truncate max-w-[200px] font-medium">{attachmentLink}</span>
                                        <button
                                            onClick={() => setAttachmentLink('')}
                                            className="ml-auto hover:text-destructive transition-colors"
                                            type="button"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                )}
                                <form onSubmit={handleTextSubmit} className="flex gap-1 md:gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setShowLinkInput(true)}
                                        className="shrink-0 h-9 w-9 md:h-10 md:w-10"
                                        disabled={!isCallActive}
                                        title="Attach Document Link"
                                    >
                                        <Paperclip className="h-4 w-4" />
                                    </Button>
                                    <Input
                                        type="text"
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        placeholder="Type message..."
                                        className="flex-1 h-9 md:h-10 text-sm"
                                        disabled={!isCallActive}
                                    />
                                    <Button
                                        type="submit"
                                        size="default"
                                        disabled={(!textInput.trim() && !attachmentLink) || !isCallActive}
                                        className="h-9 md:h-10 px-3 md:px-4"
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </form>
                            </div>
                        </Card>
                    </div>
                </div>
            )
            }
            {/* Report Generation Overlay */}
            {isGeneratingReport && (
                <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                    <div className="max-w-md w-full space-y-8">
                        {/* Animated Icon */}
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full bg-[#8da356]/10 animate-ping" style={{ animationDuration: '3s' }}></div>
                            <div className="bg-[#8da356]/10 p-8 rounded-full border-2 border-[#8da356]/20 relative">
                                <Zap className="h-12 w-12 text-[#8da356] animate-pulse" />
                            </div>
                        </div>

                        {/* Text Content */}
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Generating Report</h2>
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-3 text-[#8da356] font-bold italic h-8 animate-in slide-in-from-bottom-2 duration-300">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {[
                                        "Connecting to TalentSpotify Intelligence...",
                                        "Analyzing conversation transcripts...",
                                        "Calculating performance indicators...",
                                        "Synchronizing OKR progress data...",
                                        "Optimizing report visual layout...",
                                        "Generating your performance report..."
                                    ][generatingStep]}
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar Container */}
                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden shadow-inner border border-gray-50">
                            <div
                                className="bg-gradient-to-r from-[#8da356] to-[#7a8f4b] h-full transition-all duration-700 ease-out"
                                style={{ width: `${((generatingStep + 1) / 6) * 100}%` }}
                            ></div>
                        </div>

                        {/* Subtext */}
                        <p className="text-sm text-gray-500 font-medium">
                            Please wait while Tara AI prepares your detailed analysis.
                        </p>
                    </div>
                </div>
            )}
        </div >
    );
};
