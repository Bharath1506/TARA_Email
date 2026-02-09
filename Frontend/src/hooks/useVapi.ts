import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

import { getVapiInstance, getSystemPromptWithConfigs } from '@/services/vapiService';
import { fetchEmployeeOKRs, updateKeyResult, updateKeyResultWithRating, getFreshReviewForm, submitCompetencyReview, submitEmployeeSelfAssessment, clearReviewCache } from '@/services/okrService';

export interface VapiMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    speaker?: string; // Name of the speaker (Employee, Manager, or Tara)
}

export const useVapi = () => {
    const [isCallActive, setIsCallActive] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [messages, setMessages] = useState<VapiMessage[]>([]);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [currentSpeaker, setCurrentSpeaker] = useState<string>('Participant');
    const [beingAddressed, setBeingAddressed] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isToolExecuting, setIsToolExecuting] = useState(false);
    const [participantNames, setParticipantNames] = useState<{ employee: string, manager: string }>({ employee: 'Employee', manager: 'Manager' });
    const participantNamesRef = useRef<{ employee: string, manager: string }>({ employee: 'Employee', manager: 'Manager' });
    const [callStartTime, setCallStartTime] = useState<Date | null>(null);
    const speakerMapRef = useRef<Record<string, string>>({});
    const assignedRolesRef = useRef<string[]>([]);
    const lastTaraMessageRef = useRef<string>('');
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const silenceStageRef = useRef<number>(0);
    // Persist Session IDs for tool calls
    const userIdsRef = useRef<{ employeeId?: string, managerId?: string }>({});
    const globalReviewIdRef = useRef<string | null>(null);
    const { toast } = useToast();


    const vapi = getVapiInstance();

    useEffect(() => {
        const onCallStart = () => {
            console.log('Vapi call started');
            setIsCallActive(true);
            setCallStartTime(new Date());
            setError(null);
            // Reset speaker tracking on new call
            speakerMapRef.current = {};
            assignedRolesRef.current = [];
        };

        const onCallEnd = () => {
            console.log('Vapi call ended');
            setIsCallActive(false);
            setIsSpeaking(false);
            setIsMuted(false); // Reset mute state on call end
            setMessages([]); // Clear conversation history
            setParticipantNames({ employee: 'Employee', manager: 'Manager' }); // Reset names
            setCurrentSpeaker('Participant');
            setBeingAddressed(null);
            setTranscript('');
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceStageRef.current = 0;
            clearReviewCache();
            // Optional: reset refs? Usually fine to keep until next startCall overwrites
        };

        const onSpeechStart = () => {
            console.log('Vapi speech started');
            setIsSpeaking(true);
        };

        const onSpeechEnd = () => {
            console.log('Vapi speech ended');
            setIsSpeaking(false);
        };

        const onMessage = async (message: any) => {
            // console.log('Vapi message:', message);

            if (message.type === 'transcript' && message.transcriptType === 'final') {
                // Clear silence timer when final transcript received
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceStageRef.current = 0;
                }

                let speakerLabel = currentSpeaker;

                // Automatic Speaker Identification logic
                if (message.role === 'user') {
                    const speakerId = message.speakerId ?? message.speaker_id;

                    if (speakerId !== undefined && speakerId !== null) {
                        const sId = String(speakerId);

                        if (!speakerMapRef.current[sId]) {
                            // Assign role based on names from Ref to avoid stale closures
                            const empName = participantNamesRef.current.employee;
                            const mgrName = participantNamesRef.current.manager;

                            if (!assignedRolesRef.current.includes(empName)) {
                                speakerMapRef.current[sId] = empName;
                                assignedRolesRef.current.push(empName);
                            } else if (!assignedRolesRef.current.includes(mgrName)) {
                                speakerMapRef.current[sId] = mgrName;
                                assignedRolesRef.current.push(mgrName);
                            } else {
                                speakerMapRef.current[sId] = `Participant ${sId}`;
                            }
                        }
                        speakerLabel = speakerMapRef.current[sId];
                        setCurrentSpeaker(speakerLabel);
                    }
                } else if (message.role === 'assistant') {
                    speakerLabel = 'Tara (HR Assistant)';

                    // Logic to detect who Tara is addressing (Improved: Prioritize name at the START of the utterance)
                    const taraText = message.transcript.toLowerCase().trim();
                    const empName = participantNames.employee.toLowerCase();
                    const mgrName = participantNames.manager.toLowerCase();

                    // Tara is instructed to put the recipient's name FIRST.
                    // Check if the message starts with either name
                    const startsWithEmp = taraText.startsWith(empName);
                    const startsWithMgr = taraText.startsWith(mgrName);

                    if (startsWithEmp && !startsWithMgr) {
                        setBeingAddressed('Employee');
                    } else if (startsWithMgr && !startsWithEmp) {
                        setBeingAddressed('Manager');
                    } else {
                        // Fallback to searching the first sentence/clause
                        const firstClause = taraText.split(/[.!?]|,/).map(p => p.trim()).filter(Boolean)[0] || taraText;
                        const empInFirst = firstClause.includes(empName);
                        const mgrInFirst = firstClause.includes(mgrName);

                        if (empInFirst && !mgrInFirst) {
                            setBeingAddressed('Employee');
                        } else if (mgrInFirst && !empInFirst) {
                            setBeingAddressed('Manager');
                        } else if (empInFirst && mgrInFirst) {
                            // If both in first clause, the one that appears earlier is likely the recipient
                            setBeingAddressed(firstClause.indexOf(empName) < firstClause.indexOf(mgrName) ? 'Employee' : 'Manager');
                        }
                    }
                    lastTaraMessageRef.current = taraText;
                }

                const newMessage: VapiMessage = {
                    role: message.role === 'assistant' ? 'assistant' : 'user',
                    content: message.transcript,
                    timestamp: new Date(),
                    speaker: speakerLabel
                };

                setMessages(prev => {
                    if (prev.length > 0) {
                        const lastMsg = prev[prev.length - 1];
                        if (lastMsg.role === newMessage.role) {
                            // Check for exact duplicate content or if new content is already at the end
                            const trimmedLast = lastMsg.content.trim();
                            const trimmedNew = newMessage.content.trim();

                            // If the new content is exactly the same as the last message content, ignore it
                            if (trimmedLast === trimmedNew) {
                                return prev;
                            }

                            // If the last message ends with the new content, it might be a duplicate update
                            if (trimmedLast.endsWith(trimmedNew)) {
                                return prev;
                            }

                            // Update the last message
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...lastMsg,
                                content: lastMsg.content + ' ' + newMessage.content,
                                timestamp: newMessage.timestamp,
                                speaker: speakerLabel
                            };
                            return updated;
                        }
                    }
                    return [...prev, newMessage];
                });
            }

            if (message.type === 'transcript' && message.transcriptType === 'partial') {
                setTranscript(message.transcript);
                // Clear silence timer when user speaks
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceStageRef.current = 0;
                }
            }

            if (message.type === 'tool-calls') {
                console.log('Tool call received:', message);
                setIsToolExecuting(true);

                // Process tool calls sequentially to ensure proper order
                for (const toolCall of message.toolCallList) {
                    const toolName = toolCall.function.name;
                    const args = typeof toolCall.function.arguments === 'string'
                        ? JSON.parse(toolCall.function.arguments)
                        : toolCall.function.arguments;

                    console.log(`%c[VAPI] TOOL CALL: ${toolName}`, "color: white; background: blue; padding: 2px 5px; border-radius: 3px;", args);

                    let result = "";
                    let success = false;

                    try {
                        if (toolName === 'update_key_result' || toolName === 'update_okr_rating') {
                            // IMMEDIATELY signal success to Vapi so Tara continues speaking without lag
                            let confirmationMsg = "Update initiated.";
                            if (toolName === 'update_key_result') {
                                confirmationMsg = `SUCCESS: Key Result progress updated to ${args.value}. Proceed to next.`;
                            } else {
                                confirmationMsg = `SUCCESS: ${args.role} ${args.type} rating for '${args.name || args.id}' recorded. Proceed.`;
                            }

                            vapi.send({
                                type: 'tool-output',
                                toolCallId: toolCall.id,
                                output: confirmationMsg
                            } as any);

                            // Background the actual database persistence
                            (async () => {
                                try {
                                    console.log(`[VAPI] Background Update ${toolName}`, args);
                                    if (toolName === 'update_key_result') {
                                        const { id, value } = args;
                                        success = await updateKeyResultWithRating(id, value);
                                        if (success) {
                                            toast({
                                                title: "OKR Updated",
                                                description: `Key Result actual value updated to ${value}`,
                                                variant: "default",
                                                className: "bg-green-100 border-green-500 text-green-900"
                                            });
                                        }
                                    } else {
                                        const { id, reviewId, rating, role, type, name, comment } = args;
                                        const updateData: any = {};
                                        const ratingKey = `${role}Rating`;

                                        // Resolve Review ID
                                        // 1. Check tool args
                                        // 2. Check Session Ref (globalReviewIdRef)
                                        // 3. Check Cache/Fetch
                                        let targetId = reviewId || id;
                                        if ((!targetId || targetId === 'unknown') && globalReviewIdRef.current) {
                                            targetId = globalReviewIdRef.current;
                                        }

                                        if (!targetId || targetId === 'unknown') {
                                            // Fallback to extraction from cached form using stored user IDs
                                            const currentForm = await getFreshReviewForm(false, userIdsRef.current.employeeId, userIdsRef.current.managerId);
                                            const reviews = currentForm?.data?.review ? [currentForm.data.review] :
                                                (Array.isArray(currentForm?.data) ? currentForm.data : []);

                                            // Extract ID if found
                                            if (reviews.length > 0) {
                                                targetId = reviews[0]._id || reviews[0].id;
                                                // Cache it for next time
                                                globalReviewIdRef.current = targetId;
                                            }
                                        }
                                        updateData.id = targetId;

                                        if (type === 'objective') {
                                            const objReview: any = { id, objectiveName: name };
                                            if (rating !== undefined) objReview[ratingKey] = rating;
                                            if (comment !== undefined) objReview[`${role}Feedback`] = comment;
                                            updateData.objectiveReviews = [objReview];
                                        } else if (type === 'key_result') {
                                            const krReview: any = { id, keyResultName: name };
                                            if (rating !== undefined) krReview[ratingKey] = rating;
                                            if (comment !== undefined) krReview[`${role}Feedback`] = comment;
                                            updateData.keyResultReviews = [krReview];
                                        } else if (type === 'competency') {
                                            const competencyData: any = { competencyName: name };
                                            if (rating !== undefined) competencyData[`${role}Rating`] = rating;
                                            if (comment !== undefined) competencyData[`${role}Comments`] = comment;
                                            updateData.competencyReviews = [competencyData];
                                        } else if (type === 'accomplishments') {
                                            updateData.keyAccomplishments = comment;
                                            updateData.accomplishments = comment;
                                            updateData.cm1 = comment;
                                        } else if (type === 'next_quarter_plan') {
                                            updateData.nextQuarterPlan = comment;
                                            updateData.plan = comment;
                                            updateData.cm2 = comment;
                                        } else if (type === 'manager_comments' || type === 'manager_comment') {
                                            updateData.managerOverallComments = comment;
                                            updateData.cm3 = comment;
                                        }

                                        updateData.employeeFullName = participantNamesRef.current.employee;
                                        updateData.managerName = participantNamesRef.current.manager;

                                        const isManagerComment = type === 'manager_comments' || type === 'manager_comment';
                                        const isEmployeeFlow = (role === 'employee' && !isManagerComment) || type === 'accomplishments' || type === 'next_quarter_plan';

                                        if (isEmployeeFlow) success = await submitEmployeeSelfAssessment(updateData);
                                        else success = await submitCompetencyReview(updateData);

                                        if (success) {
                                            toast({
                                                title: "Review Updated",
                                                description: `${role === 'employee' ? 'Employee' : 'Manager'} ${type} has been saved.`,
                                                variant: "default",
                                                className: "bg-purple-100 border-purple-500 text-purple-900"
                                            });
                                        }
                                    }
                                } catch (bgError) {
                                    console.error(`%c[VAPI] Background update error for ${toolName}:`, "color: red;", bgError);
                                }
                            })();
                            continue; // Skip the blocking result logic for these tools
                        }

                        if (toolName === 'submit_employee_self_assessment') {
                            console.log("%c[VAPI] submit_employee_self_assessment call detected (Finalization)", "color: cyan; font-weight: bold;");
                            success = await submitEmployeeSelfAssessment(args);
                            result = success ? "Success" : "Failed";
                        } else if (toolName === 'submit_competency_review') {
                            console.log("%c[VAPI] submit_competency_review call detected (Finalization)", "color: orange; font-weight: bold;");
                            success = await submitCompetencyReview(args);
                            result = success ? "Success" : "Failed";
                        } else if (toolName === 'end_session') {
                            result = "Ending session.";
                            setTimeout(() => vapi.stop(), 3000);
                        } else {
                            result = `Unknown tool: ${toolName}`;
                        }

                        vapi.send({
                            type: 'tool-output',
                            toolCallId: toolCall.id,
                            output: result
                        } as any);

                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        console.error(`%c[VAPI] Error executing tool ${toolName}:`, "color: red; font-weight: bold;", e);
                        result = `Error: ${errorMessage}`;

                        vapi.send({
                            type: 'tool-output',
                            toolCallId: toolCall.id,
                            output: result
                        } as any);

                        toast({
                            title: "Tool Execution Error",
                            description: `Error executing ${toolName}: ${errorMessage}`,
                            variant: "destructive"
                        });
                    }
                }
                setIsToolExecuting(false);
            }
        };

        const onError = (error: any) => {
            console.error('Detailed Vapi Error:', error);
            let errorMessage = error?.error?.message || error?.message;

            if (!errorMessage && typeof error === 'object') {
                errorMessage = JSON.stringify(error);
            }

            if (errorMessage === '{}' || !errorMessage) {
                errorMessage = "Connection error. Please check if http://localhost:8080 is whitelisted in your Vapi Dashboard CORS settings.";
            }

            setError(errorMessage);
        };

        vapi.on('call-start', onCallStart);
        vapi.on('call-end', onCallEnd);
        vapi.on('speech-start', onSpeechStart);
        vapi.on('speech-end', onSpeechEnd);
        vapi.on('message', onMessage);
        vapi.on('error', onError);

        return () => {
            vapi.off('call-start', onCallStart);
            vapi.off('call-end', onCallEnd);
            vapi.off('speech-start', onSpeechStart);
            vapi.off('speech-end', onSpeechEnd);
            vapi.off('message', onMessage);
            vapi.off('error', onError);
        };
    }, [vapi]);

    // Silence detection logic
    useEffect(() => {
        if (!isCallActive) {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceStageRef.current = 0;
            return;
        }

        if (isSpeaking || isToolExecuting) {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceStageRef.current = 0;
            return;
        }

        const monitorSilence = () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

            silenceTimerRef.current = setTimeout(() => {
                if (!isCallActive || isSpeaking || isToolExecuting) return;

                silenceStageRef.current += 1;
                console.log(`Silence detected. Stage: ${silenceStageRef.current}`);

                if (silenceStageRef.current === 1) {
                    vapi.send({
                        type: 'add-message',
                        message: {
                            role: 'system',
                            content: "There has been a naturally long pause. Keeping your supportive tone, please check if they are ready or need more time. LEAD WITH THEIR NAME."
                        }
                    } as any);
                } else if (silenceStageRef.current === 2) {
                    vapi.send({
                        type: 'add-message',
                        message: {
                            role: 'system',
                            content: "The participants are still silent. Offer to move to the next section or provide assistance. LEAD WITH NAME."
                        }
                    } as any);
                } else if (silenceStageRef.current >= 3) {
                    vapi.send({
                        type: 'add-message',
                        message: {
                            role: 'system',
                            content: "Extended silence. Please conclude the session politely and call the end_session tool."
                        }
                    } as any);
                    return; // Stop monitoring once we tell it to end
                }
                monitorSilence();
            }, silenceStageRef.current === 0 ? 20000 : 25000);
        };

        monitorSilence();

        return () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };
    }, [isCallActive, isSpeaking, isToolExecuting, vapi]);

    const startCall = useCallback(async (managerInputName?: string, employeeInputName?: string, employeeId?: string, managerId?: string) => {
        try {
            console.log('Fetching OKRs for:', employeeId || 'Default');
            const okrs = await fetchEmployeeOKRs(employeeId, managerId);
            console.log('Fetching Review Form for:', employeeId || 'Default');
            // Use getFreshReviewForm to ensure the cache is populated for optimistic updates
            const reviewData = await getFreshReviewForm(true, employeeId, managerId);

            // Store Session IDs for tool call usage
            userIdsRef.current = { employeeId, managerId };

            // Extract and Store Review ID
            let foundReviewId = null;
            if (reviewData) {
                const reviews = reviewData.data?.review ? [reviewData.data.review] :
                    (Array.isArray(reviewData.data) ? reviewData.data :
                        (Array.isArray(reviewData) ? reviewData : [reviewData]));

                if (reviews.length > 0) {
                    foundReviewId = reviews[0]._id || reviews[0].id;
                    console.log("[VAPI] Session Review ID found:", foundReviewId);
                    globalReviewIdRef.current = foundReviewId;
                }
            }
            if (!foundReviewId) console.warn("[VAPI] No Review ID found at start.");

            setParticipantNames({ employee: employeeInputName || 'Employee', manager: managerInputName || 'Manager' });
            participantNamesRef.current = { employee: employeeInputName || 'Employee', manager: managerInputName || 'Manager' };

            const systemPrompt = getSystemPromptWithConfigs(okrs, reviewData, employeeInputName, managerInputName);
            const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID || '416bb3db-da61-4512-aca3-1002b4b5d13f';

            // Start the call using the Assistant ID from the dashboard.
            // We MUST provide the provider and model name when overriding the dynamic messages (system prompt)
            // and firstMessage to ensure participant names are correctly used.
            await vapi.start(assistantId, {
                model: {
                    provider: 'groq',
                    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        }
                    ],
                    tools: [
                        {
                            type: "function",
                            function: {
                                name: "update_key_result",
                                description: "Updates ONLY the progress (actual value) of a specific Key Result. Call this when the employee confirms a new actual value.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        value: { type: "string" }
                                    },
                                    required: ["id", "value"]
                                }
                            }
                        },
                        {
                            type: "function",
                            function: {
                                name: "update_okr_rating",
                                description: "Updates the rating for an Objective, Key Result, or Competency immediately after it is provided.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        reviewId: { type: "string", description: "The overarching Review ID from Review Metadata (e.g., MongoDB _id)" },
                                        id: { type: "string", description: "The specific item ID from the OKR DATA LIST (e.g., '679c...', 'r1', 'o1')" },
                                        name: { type: "string", description: "The clear text name of the Objective, Key Result, or Competency" },
                                        rating: { type: "number", description: "Rating (1-5)" },
                                        comment: { type: "string", description: "Feedback text" },
                                        role: { type: "string", enum: ["employee", "manager"] },
                                        type: { type: "string", enum: ["objective", "key_result", "competency", "accomplishments", "next_quarter_plan", "manager_comments"] }
                                    },
                                    required: ["role", "type"]
                                }
                            }
                        },
                        {
                            type: "function",
                            function: {
                                name: "submit_employee_self_assessment",
                                description: "Submits all captured employee reviews. Call this before ending the session.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        objectiveReviews: { type: "array", items: { type: "object" } },
                                        keyResultReviews: { type: "array", items: { type: "object" } }
                                    }
                                }
                            }
                        },
                        {
                            type: "function",
                            function: {
                                name: "submit_competency_review",
                                description: "Submits all captured competency reviews. Call this before ending the session.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        competencyReviews: { type: "array", items: { type: "object" } }
                                    }
                                }
                            }
                        },
                        {
                            type: "function",
                            function: {
                                name: "end_session",
                                description: "Ends the voice session.",
                                parameters: { type: "object", properties: {} }
                            }
                        }
                    ]
                },
                firstMessage: `Hi. I'm Tara, your HRAI assistant. Thank you, ${employeeInputName || 'Employee'} and ${managerInputName || 'Manager'} thank you for joining the performance review session. Can we start?`,
                silenceTimeoutSeconds: 30,
                maxDurationSeconds: 1800,
                fillersEnabled: true
            } as any);

        } catch (err: any) {
            console.error('Failed to start call:', err);
            setError(err.message || 'Failed to start call');
        }
    }, [vapi]);

    const stopCall = useCallback(async () => {
        try {
            await vapi.stop();
        } catch (err: any) {
            setError(err.message || 'Failed to stop call');
        }
    }, [vapi]);

    const sendMessage = useCallback((message: string) => {
        try {
            vapi.send({
                type: 'add-message',
                message: { role: 'user', content: message }
            } as any);

            const newMessage: VapiMessage = {
                role: 'user',
                content: message,
                timestamp: new Date(),
                speaker: currentSpeaker
            };
            setMessages(prev => [...prev, newMessage]);
        } catch (err: any) {
            setError(err.message || 'Failed to send message');
        }
    }, [vapi, currentSpeaker]);

    const setSpeaker = useCallback((speakerName: string) => {
        setCurrentSpeaker(speakerName);
    }, []);

    const toggleMute = useCallback(() => {
        const newMuteState = !isMuted;
        try {
            vapi.setMuted(newMuteState);
            setIsMuted(newMuteState);
            return true;
        } catch (err) {
            console.error('Failed to toggle mute:', err);
            return false;
        }
    }, [vapi, isMuted]);

    return {
        isCallActive,
        isSpeaking,
        isMuted,
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
        toggleMute
    };
};
