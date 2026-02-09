import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Download, Send, Volume2, VolumeX, Bot, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useVapi } from '@/hooks/useVapi';
import logoImage from '@/assets/talentspotify-logo.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Participant {
  name: string;
  id?: string;
  role: 'employee' | 'manager';
}

export const VoiceInterface = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentCaption, setCurrentCaption] = useState('');
  const [reviewStage, setReviewStage] = useState<'setup' | 'intro' | 'employee' | 'manager' | 'summary'>('setup');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [setupStep, setSetupStep] = useState<'who' | 'employeeName' | 'employeeId' | 'managerName' | 'managerId' | 'confirm' | 'complete'>('who');
  const [tempEmployeeName, setTempEmployeeName] = useState('');
  const [tempEmployeeId, setTempEmployeeId] = useState('');
  const [tempManagerName, setTempManagerName] = useState('');
  const [tempManagerId, setTempManagerId] = useState('');
  const [textInput, setTextInput] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const lastTranscribedTextRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to speak Tara's response
  const speakText = (text: string) => {
    if (!voiceEnabled) {
      console.log('Voice is disabled');
      return;
    }

    console.log('Attempting to speak:', text);

    // Stop any ongoing speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Configure voice settings
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to use a female voice if available
    const voices = window.speechSynthesis.getVoices();
    console.log('Available voices:', voices.length);
    const femaleVoice = voices.find(voice =>
      voice.name.toLowerCase().includes('female') ||
      voice.name.toLowerCase().includes('zira') ||
      voice.name.toLowerCase().includes('samantha') ||
      voice.name.toLowerCase().includes('karen') ||
      voice.name.toLowerCase().includes('susan')
    );
    if (femaleVoice) {
      utterance.voice = femaleVoice;
      console.log('Using voice:', femaleVoice.name);
    } else {
      console.log('Using default voice');
    }

    utterance.onstart = () => {
      console.log('Speech started');
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      console.log('Speech ended');
      setIsSpeaking(false);
      speechSynthesisRef.current = null;
    };

    utterance.onerror = (event) => {
      console.error('Speech error:', event);
      setIsSpeaking(false);
      speechSynthesisRef.current = null;
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    console.log('Speech queued');
  };

  // Stop speaking
  const stopSpeaking = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      speechSynthesisRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      chunksRef.current = [];
      setTranscribedText('');
      setFinalTranscript('');
      finalTranscriptRef.current = '';
      lastTranscribedTextRef.current = '';

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      isRecordingRef.current = true;

      // Initialize Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        console.log('Speech Recognition is available');
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          console.log('Recognition result event:', event.results.length, 'results');
          let interimTranscript = '';
          let newFinalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(`Result ${i}: "${transcript}" (final: ${event.results[i].isFinal})`);
            if (event.results[i].isFinal) {
              newFinalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          // Accumulate final transcripts
          if (newFinalTranscript) {
            finalTranscriptRef.current += newFinalTranscript;
            setFinalTranscript(finalTranscriptRef.current.trim());
            console.log('Final transcript updated:', finalTranscriptRef.current.trim());
          }

          // Show both final and interim for display
          const fullTranscript = finalTranscriptRef.current + interimTranscript;
          const trimmedTranscript = fullTranscript.trim();
          setTranscribedText(trimmedTranscript);
          console.log('Display transcript:', trimmedTranscript);
          // Store in ref for later use
          if (trimmedTranscript) {
            lastTranscribedTextRef.current = trimmedTranscript;
            setCurrentCaption(trimmedTranscript);
            // Update last speech time whenever we get a result
            lastSpeechTimeRef.current = Date.now();
          }

          // Reset silence timer on any speech
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          // Set new silence timer
          // Auto-stop disabled as per user request
          /*
          silenceTimerRef.current = setTimeout(() => {
            // Check if we are still recording and have some text
            if (isRecordingRef.current) {
              // If we have text, stop recording to process it
              if (lastTranscribedTextRef.current || finalTranscriptRef.current) {
                stopRecording();
              }
            }
          }, 3000); // 3 seconds silence timeout
          */
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error, event);
          if (event.error === 'no-speech') {
            console.log('No speech detected, continuing to listen...');
            // No speech detected, keep listening
            return;
          }
          if (event.error !== 'aborted') {
            setCurrentCaption('Listening...');
          }
        };

        recognition.onstart = () => {
          console.log('Speech recognition started');
        };

        recognition.onend = () => {
          console.log('Speech recognition ended');
          // If we're no longer recording, don't restart
          if (!isRecordingRef.current) {
            console.log('Not recording, not restarting recognition');
            return;
          }
          // Restart recognition if still recording
          console.log('Restarting recognition...');
          try {
            recognition.start();
          } catch (e) {
            console.error('Error restarting recognition:', e);
          }
        };

        recognitionRef.current = recognition;
        // Add a small delay before starting to avoid conflicts
        setTimeout(() => {
          try {
            console.log('Starting speech recognition...');
            recognition.start();
          } catch (e) {
            console.error("Failed to start recognition:", e);
          }
        }, 100);
      } else {
        console.error('Speech Recognition is NOT available in this browser');
        toast({
          title: "Speech Recognition Unavailable",
          description: "Your browser doesn't support speech recognition. Please use Chrome or Edge.",
          variant: "destructive",
        });
      }

      toast({
        title: "Recording started",
        description: "Speak into your microphone",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      isRecordingRef.current = false;
      setIsRecording(false);

      // Stop speech recognition first, but wait a bit for final transcript
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Recognition might already be stopped
        }
        // Wait a moment for any final transcript to be processed
        setTimeout(() => {
          recognitionRef.current = null;
        }, 500);
      }

      // Stop media recorder
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());



      setCurrentCaption('');

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
  };

  const processUserInput = (userInput: string) => {
    const userMessage: Message = {
      role: 'user',
      content: userInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // Simulate Tara's response based on review stage
    setTimeout(() => {
      let taraResponse = '';
      const lowerInput = userInput.toLowerCase();

      if (reviewStage === 'setup') {
        // Handle participant setup flow
        switch (setupStep) {
          case 'who':
            // Check if user confirmed presence of both parties
            if (lowerInput.includes('yes') || lowerInput.includes('both') ||
              lowerInput.includes('present') || lowerInput.includes('here') ||
              lowerInput.includes('we are') || lowerInput.includes('ready')) {
              taraResponse = "Great! Let's get started. First, what is the employee's name?";
              setSetupStep('employeeName');
            } else {
              // If the user seems to be giving a name directly, we can be flexible, but let's try to stick to the flow
              // Or if they said "no" or something else
              if (lowerInput.includes('no') || lowerInput.includes('not')) {
                taraResponse = "This review session requires both an employee and a manager. Please ensure both are present. Are you both ready to proceed?";
              } else {
                // Fallback - assume they might be saying yes or giving a name, but prompt for employee name to be sure
                taraResponse = "I'll take that as a yes. Let's begin with the employee's details. What is the employee's name?";
                setSetupStep('employeeName');
              }
            }
            break;

          case 'employeeName':
            // Extract employee name (simplified - in production, use NLP)
            // Try to extract name from input, or use a default
            let extractedEmployeeName = lowerInput.trim() || 'Employee';
            // Capitalize first letter
            extractedEmployeeName = extractedEmployeeName.charAt(0).toUpperCase() + extractedEmployeeName.slice(1);
            // Remove common phrases
            extractedEmployeeName = extractedEmployeeName.replace(/^(the |my name is |i am |this is )/i, '').trim();
            if (!extractedEmployeeName || extractedEmployeeName === 'Audio captured') {
              extractedEmployeeName = 'Employee';
            }
            setTempEmployeeName(extractedEmployeeName);
            taraResponse = `Thank you, ${extractedEmployeeName}. Now, please provide your Employee ID.`;
            setSetupStep('employeeId');
            break;

          case 'employeeId':
            // Extract employee ID
            const extractedEmployeeId = lowerInput.trim().replace(/^(my id is |id is |it is )/i, '').toUpperCase();
            setTempEmployeeId(extractedEmployeeId);
            taraResponse = "Got it. Now, what is the manager's name?";
            setSetupStep('managerName');
            break;

          case 'managerName':
            // Extract manager name (simplified - in production, use NLP)
            let extractedManagerName = lowerInput.trim() || 'Manager';
            // Capitalize first letter
            extractedManagerName = extractedManagerName.charAt(0).toUpperCase() + extractedManagerName.slice(1);
            // Remove common phrases
            extractedManagerName = extractedManagerName.replace(/^(the |my name is |i am |this is |manager is |manager's name is )/i, '').trim();
            if (!extractedManagerName || extractedManagerName === 'Audio captured') {
              extractedManagerName = 'Manager';
            }
            setTempManagerName(extractedManagerName);
            taraResponse = `Thank you, ${extractedManagerName}. And finally, please provide the manager's Employee ID.`;
            setSetupStep('managerId');
            break;

          case 'managerId':
            // Extract manager ID
            const extractedManagerId = lowerInput.trim().replace(/^(my id is |id is |it is )/i, '').toUpperCase();
            setTempManagerId(extractedManagerId);

            const employeeName = tempEmployeeName || 'Employee';
            const managerName = tempManagerName || 'Manager';

            taraResponse = `Great! Let me confirm the details:\n\nEmployee: ${employeeName}\nEmployee ID: ${tempEmployeeId}\n\nManager: ${managerName}\nManager ID: ${extractedManagerId}\n\nIs this information correct? Please say 'yes' to confirm, or use the text box below to make any corrections. For example, type: "Employee name: John Doe, Employee ID: E123, Manager name: Jane Smith, Manager ID: M456"`;
            setSetupStep('confirm');
            break;

          case 'confirm':
            // Check if user is confirming or making corrections
            if (lowerInput.includes('yes') || lowerInput.includes('correct') || lowerInput.includes('confirm')) {
              // User confirmed, proceed
              setParticipants([
                { name: tempEmployeeName || 'Employee', id: tempEmployeeId, role: 'employee' },
                { name: tempManagerName || 'Manager', id: tempManagerId, role: 'manager' }
              ]);
              taraResponse = `Perfect! Thank you both for joining this performance review. I'm Tara, your HR assistant. Let's start with ${tempEmployeeName || 'Employee'}'s self-assessment. Please share your key achievements and areas for growth.`;
              setSetupStep('complete');
              setReviewStage('employee');
            } else {
              // User is making corrections - parse the input
              let updatedEmployeeName = tempEmployeeName;
              let updatedEmployeeId = tempEmployeeId;
              let updatedManagerName = tempManagerName;
              let updatedManagerId = tempManagerId;

              // Try to extract corrected information
              const employeeNameMatch = userInput.match(/employee name[:\s]+([^,]+)/i);
              const employeeIdMatch = userInput.match(/employee id[:\s]+([^,]+)/i);
              const managerNameMatch = userInput.match(/manager name[:\s]+([^,]+)/i);
              const managerIdMatch = userInput.match(/manager id[:\s]+([^,]+)/i);

              if (employeeNameMatch) updatedEmployeeName = employeeNameMatch[1].trim();
              if (employeeIdMatch) updatedEmployeeId = employeeIdMatch[1].trim().toUpperCase();
              if (managerNameMatch) updatedManagerName = managerNameMatch[1].trim();
              if (managerIdMatch) updatedManagerId = managerIdMatch[1].trim().toUpperCase();

              setTempEmployeeName(updatedEmployeeName);
              setTempEmployeeId(updatedEmployeeId);
              setTempManagerName(updatedManagerName);
              setTempManagerId(updatedManagerId);

              taraResponse = `I've updated the information:\n\nEmployee: ${updatedEmployeeName}\nEmployee ID: ${updatedEmployeeId}\n\nManager: ${updatedManagerName}\nManager ID: ${updatedManagerId}\n\nIs this correct now? Say 'yes' to confirm or make more corrections using the text box.`;
            }
            break;

          default:
            taraResponse = "Let me help facilitate this conversation further. What would you like to discuss next?";
        }
      } else {
        // Handle review stages
        switch (reviewStage) {
          case 'intro':
            taraResponse = "Thank you for joining this performance review. I'm Tara, your HR assistant. Let's start with the employee's self-assessment. Please share your key achievements and areas for growth.";
            setReviewStage('employee');
            break;
          case 'employee':
            const employee = participants.find(p => p.role === 'employee') || { name: 'Employee', role: 'employee' as const };
            const manager = participants.find(p => p.role === 'manager') || { name: 'Manager', role: 'manager' as const };
            taraResponse = `Excellent insights, ${employee.name}. Now, let's hear from ${manager.name}. Please provide your perspective on ${employee.name}'s performance, strengths, and development opportunities.`;
            setReviewStage('manager');
            break;
          case 'manager':
            taraResponse = "Thank you both for your thoughtful input. Based on this discussion, I'll summarize the key points and we can align on development goals and next steps.";
            setReviewStage('summary');
            break;
          default:
            taraResponse = "Let me help facilitate this conversation further. What would you like to discuss next?";
        }
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: taraResponse,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Speak Tara's response
      speakText(taraResponse);
    }, 1000);
  };

  const processAudio = async (audioBlob: Blob) => {
    // TODO: Send audio to your backend for transcription and AI processing
    // Your backend should include Tara's system prompt:
    // "You are Tara, an HR performance review voice assistant for TalentSpotify. 
    // Facilitate structured, fair three-way performance reviews among Employee, Manager, and yourself."

    // Wait a bit for any final transcription to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get the transcribed text - check multiple sources in priority order
    let userInput = '';

    // Priority 1: Final transcript (most accurate)
    if (finalTranscriptRef.current.trim()) {
      userInput = finalTranscriptRef.current.trim();
    }
    // Priority 2: Last transcribed text from ref (preserved)
    else if (lastTranscribedTextRef.current.trim()) {
      userInput = lastTranscribedTextRef.current.trim();
    }
    // Priority 3: Current transcribed text state
    else if (transcribedText.trim()) {
      userInput = transcribedText.trim();
    }

    // Filter out status messages - these should not be used as actual content
    const statusMessages = ['tara is listening', 'processing your input', 'transcribing speech', 'listening'];
    const isStatusMessage = userInput && statusMessages.some(msg => userInput.toLowerCase().includes(msg));

    // If we have real transcription (not just status messages), use it
    if (userInput && !isStatusMessage && userInput.length > 0) {
      processUserInput(userInput);
    } else {
      // One more check after a short delay for any late-arriving transcription
      await new Promise(resolve => setTimeout(resolve, 500));
      const finalCheck = finalTranscriptRef.current.trim() || lastTranscribedTextRef.current.trim() || transcribedText.trim();
      if (finalCheck && !statusMessages.some(msg => finalCheck.toLowerCase().includes(msg)) && finalCheck.length > 0) {
        processUserInput(finalCheck);
      } else {
        // Last resort - only if we truly have no transcription
        console.warn('No transcription available, using fallback');
        processUserInput('Participant spoke');
      }
    }

    // Clear transcribed text after processing (but keep ref for safety)
    setTranscribedText('');
    setFinalTranscript('');
    finalTranscriptRef.current = '';
    // Don't clear lastTranscribedTextRef immediately - keep it for a bit
    setTimeout(() => {
      lastTranscribedTextRef.current = '';
    }, 2000);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    processUserInput(textInput.trim());
    setTextInput('');
  };

  const downloadReport = () => {
    const employee = participants.find(p => p.role === 'employee');
    const manager = participants.find(p => p.role === 'manager');

    const header = `
TalentSpotify Performance Review Report
Generated by Tara, HR Assistant
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}
Review Stage: ${reviewStage}
${employee ? `Employee: ${employee.name}` : ''}
${manager ? `Manager: ${manager.name}` : ''}
${'='.repeat(60)}

`;

    const report = header + messages.map(msg =>
      `[${msg.timestamp.toLocaleTimeString()}] ${msg.role === 'assistant' ? 'TARA' : 'PARTICIPANT'}: ${msg.content}`
    ).join('\n\n');

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

  useEffect(() => {
    if (isRecording && !transcribedText) {
      const captions = [
        'Tara is listening...',
        'Processing your input...',
        'Transcribing speech...'
      ];
      let index = 0;
      const interval = setInterval(() => {
        // Only update if there's still no transcribed text
        if (!transcribedText) {
          setCurrentCaption(captions[index % captions.length]);
          index++;
        }
      }, 2000);

      return () => clearInterval(interval);
    } else if (!isRecording) {
      setCurrentCaption('');
    }
  }, [isRecording, transcribedText]);

  // Load voices when component mounts
  useEffect(() => {
    // Load voices (some browsers need this)
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Initialize with Tara's greeting
  useEffect(() => {
    if (messages.length === 0) {
      const greeting: Message = {
        role: 'assistant',
        content: "Hello! I'm Tara, your HR performance review assistant from TalentSpotify. I'm here to facilitate a fair and structured three-way performance review. Before we begin, are both the Employee and Manager present for this session?",
        timestamp: new Date()
      };
      setMessages([greeting]);
      // Speak the greeting after a short delay
      setTimeout(() => {
        speakText(greeting.content);
      }, 500);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-assistant-bg p-4">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-card/50 backdrop-blur border border-border p-4 rounded-xl shadow-sm">
          {/* Left: Branding */}
          <div className="flex items-center gap-4">
            <img
              src={logoImage}
              alt="TalentSpotify Logo"
              className="h-16 w-auto"
            />
            <div className="text-left">
              <h2 className="text-2xl font-semibold text-foreground">Performance Review</h2>
              <p className="text-xs text-muted-foreground">with Tara, AI HR Assistant</p>
            </div>
          </div>

          {/* Center: Placeholder for balance */}
          <div className="flex-1"></div>

          {/* Right: Placeholder for balance or other controls if needed */}
          <div className="w-[100px]"></div>
        </div>

        {/* Three Column Layout */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Tara AI Agent Column */}
          <Card className="p-4 bg-card/50 backdrop-blur border-border h-[500px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="flex flex-col items-center justify-center space-y-4 w-full h-full">
              <h3 className="text-xl font-semibold text-foreground">Tara</h3>

              {/* Animated Tara Avatar */}
              <div className="relative">
                {/* Glowing background when speaking */}
                {isSpeaking && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: '2s' }}></div>
                    <div className="absolute inset-0 rounded-full bg-accent/20 animate-pulse"></div>
                  </>
                )}

                {/* Sparkles animation when speaking */}
                {isSpeaking && (
                  <div className="absolute -top-4 -right-4">
                    <Sparkles className={`h-6 w-6 text-accent animate-spin`} style={{ animationDuration: '3s' }} />
                  </div>
                )}
                {isSpeaking && (
                  <div className="absolute -bottom-4 -left-4">
                    <Sparkles className={`h-5 w-5 text-primary animate-spin`} style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                  </div>
                )}
                {isSpeaking && (
                  <div className="absolute top-0 -left-4">
                    <Sparkles className={`h-4 w-4 text-accent animate-pulse`} style={{ animationDelay: '1s' }} />
                  </div>
                )}

                {/* Main Bot Icon */}
                <div className={`relative z-10 transition-all duration-300 ${isSpeaking
                  ? 'scale-110 animate-bounce'
                  : 'scale-100'
                  }`}>
                  <div className={`p-6 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border-2 ${isSpeaking
                    ? 'border-primary shadow-lg shadow-primary/50'
                    : 'border-border'
                    } transition-all duration-300`}>
                    <Bot className={`h-20 w-20 ${isSpeaking
                      ? 'text-primary animate-pulse'
                      : 'text-muted-foreground'
                      } transition-colors duration-300`} />
                  </div>
                </div>
              </div>

              {/* Status Text */}
              <div className="text-center space-y-2 min-h-[60px] flex flex-col items-center justify-center">
                {isSpeaking ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }}></div>
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '200ms' }}></div>
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '400ms' }}></div>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-primary">Tara is speaking...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">AI HR Assistant</p>
                    <p className="text-xs text-muted-foreground">Ready to assist</p>
                  </div>
                )}
              </div>

              {/* Setup/Stage Status Indicator */}
              <div className="flex justify-center w-full my-2">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-assistant-bg border border-border shadow-sm">
                  <div className="h-2 w-2 rounded-full bg-accent animate-pulse"></div>
                  <span className="text-sm font-semibold text-foreground">
                    {reviewStage === 'setup'
                      ? `Setup: ${setupStep === 'who' ? 'Participants' : setupStep === 'employeeName' ? 'Employee Name' : setupStep === 'employeeId' ? 'Employee ID' : setupStep === 'managerName' ? 'Manager Name' : setupStep === 'managerId' ? 'Manager ID' : setupStep === 'confirm' ? 'Confirm Details' : 'Complete'}`
                      : `Stage: ${reviewStage.charAt(0).toUpperCase() + reviewStage.slice(1)}`}
                  </span>
                </div>
              </div>

              {/* Participants Display in Tara Grid */}
              {participants.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2 w-full px-4">
                  {participants.map((p, idx) => (
                    <div key={idx} className="px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-xs flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${p.role === 'employee' ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground opacity-70">({p.role})</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Voice Control Button in Tara Grid */}
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isSpeaking) {
                      stopSpeaking();
                    } else {
                      setVoiceEnabled(!voiceEnabled);
                    }
                  }}
                  className={`gap-2 h-8 text-xs rounded-full border ${voiceEnabled ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-border text-muted-foreground'}`}
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="h-3 w-3" />
                      Stop Speaking
                    </>
                  ) : voiceEnabled ? (
                    <>
                      <Volume2 className="h-3 w-3" />
                      Voice Enabled
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-3 w-3" />
                      Voice Disabled
                    </>
                  )}
                </Button>
              </div>

              {/* Current Message Preview */}
              {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
                <div className="w-full max-h-32 overflow-y-auto bg-assistant-bg/50 rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Latest:</p>
                  <p className="text-sm text-foreground line-clamp-3">
                    {messages[messages.length - 1].content}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Review Transcript Side */}
          <Card className="p-4 bg-card/50 backdrop-blur border-border h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-foreground">Review Transcript</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadReport}
                className="gap-2"
                disabled={messages.length <= 1}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
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
                      <p className="text-sm font-medium mb-1 text-muted-foreground">
                        {msg.role === 'user'
                          ? (participants.length > 0
                            ? (reviewStage === 'employee' || setupStep === 'employeeName'
                              ? participants.find(p => p.role === 'employee')?.name || 'Participant'
                              : reviewStage === 'manager' || setupStep === 'managerName'
                                ? participants.find(p => p.role === 'manager')?.name || 'Participant'
                                : 'Participant')
                            : 'Participant')
                          : 'Tara (HR Assistant)'}
                      </p>
                      <p className="text-base whitespace-pre-wrap">{msg.content || '...'}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Live Transcription Preview */}
              {transcribedText && (
                <div className="p-4 rounded-lg animate-in fade-in slide-in-from-bottom-2 bg-secondary/50 text-secondary-foreground ml-8 border border-dashed border-secondary-foreground/20">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1 text-muted-foreground flex items-center gap-2">
                        {isRecording ? (
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
                      <p className="text-base whitespace-pre-wrap">{transcribedText}</p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </Card>

          {/* Voice Control Side */}
          <Card className="p-4 bg-card/50 backdrop-blur border-border h-[500px] flex flex-col items-center justify-center">
            <div className="flex flex-col items-center space-y-4 w-full">
              <h3 className="text-xl font-semibold text-foreground">Voice Control</h3>

              {/* Animated Microphone Visualization */}
              <div className="relative">
                {/* Pulsing rings */}
                {isRecording && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping" style={{ animationDuration: '1.5s' }}></div>
                    <div className="absolute inset-0 rounded-full bg-accent/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>
                  </>
                )}

                {/* Main microphone button */}
                <Button
                  size="lg"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`h-24 w-24 rounded-full transition-all relative z-10 ${isRecording
                    ? 'bg-destructive hover:bg-destructive/90 animate-pulse shadow-lg shadow-destructive/50'
                    : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30'
                    }`}
                >
                  {isRecording ? (
                    <div className="flex flex-col items-center gap-2">
                      <MicOff className="h-8 w-8" />
                      <span className="text-xs">Stop</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Mic className="h-8 w-8" />
                      <span className="text-xs">Start</span>
                    </div>
                  )}
                </Button>
              </div>

              {/* Status Display */}
              <div className="text-center min-h-[60px] flex items-center justify-center w-full">
                {isRecording && currentCaption && (
                  <div className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 justify-center mb-2">
                      <div className="flex gap-1">
                        <div className="h-8 w-1 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                        <div className="h-10 w-1 bg-accent rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                        <div className="h-6 w-1 bg-accent rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                        <div className="h-9 w-1 bg-accent rounded-full animate-pulse" style={{ animationDelay: '450ms' }}></div>
                        <div className="h-7 w-1 bg-accent rounded-full animate-pulse" style={{ animationDelay: '600ms' }}></div>
                      </div>
                    </div>
                    <p className="text-lg font-medium text-primary">
                      {transcribedText || currentCaption}
                    </p>
                  </div>
                )}

                {!isRecording && messages.length <= 1 && (
                  <p className="text-muted-foreground">Click the microphone to begin your review session</p>
                )}
                {!isRecording && reviewStage === 'setup' && messages.length > 1 && (
                  <p className="text-muted-foreground">
                    {setupStep === 'who' && "Tell Tara who is participating in this review"}
                    {setupStep === 'employeeName' && "Tell Tara the employee's name"}
                    {setupStep === 'employeeId' && "Tell Tara the employee's ID"}
                    {setupStep === 'managerName' && "Tell Tara the manager's name"}
                    {setupStep === 'managerId' && "Tell Tara the manager's ID"}
                    {setupStep === 'confirm' && "Confirm the details or use the text box to make corrections"}
                  </p>
                )}
              </div>

              {/* Text Input */}
              <div className="w-full space-y-2">
                <h4 className="font-semibold text-sm text-foreground text-center">Or type your message:</h4>
                <form onSubmit={handleTextSubmit} className="flex gap-2">
                  <Input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type your message to Tara..."
                    className="flex-1"
                    disabled={isRecording}
                  />
                  <Button
                    type="submit"
                    size="default"
                    disabled={!textInput.trim() || isRecording}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </form>
              </div>

              {/* Instructions */}
              <div className="bg-assistant-bg/50 rounded-lg p-4 w-full border border-border">
                <h4 className="font-semibold text-sm text-foreground mb-2">How to use:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Click microphone to start recording</li>
                  <li>• Or type your message in the text box above</li>
                  <li>• Speak clearly or type about your review points</li>
                  <li>• Tara will guide you through each stage</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
