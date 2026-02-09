# Vapi Voice Agent Integration

This application now uses **Vapi** for real-time voice conversations with Tara, the HR Assistant.

## Setup

### 1. API Keys
Your Vapi API keys are stored in `.env`:
- **Public Key**: `480036f2-79db-46e7-8d3a-e4857c11f4fd`
- **Private Key**: `f25480d6-3b64-4a86-9fc4-2039ff0a28ef`

### 2. Installation
The Vapi SDK has been installed:
```bash
npm install @vapi-ai/web
```

### 3. Files Created
- `src/services/vapiService.ts` - Vapi configuration and initialization
- `src/hooks/useVapi.ts` - React hook for Vapi integration
- `src/components/VapiVoiceInterface.tsx` - New voice interface using Vapi

## How It Works

### Voice Agent Configuration
The Vapi assistant is configured with:
- **Model**: GPT-4 (OpenAI)
- **Voice**: Alloy (OpenAI female voice)
- **Transcriber**: Deepgram Nova-2
- **Language**: English (US)

### Features
1. **Real-time Voice Conversation**: Click "Start Call" to begin talking with Tara
2. **Live Transcription**: See what you're saying in real-time
3. **Text Input**: Type messages if you prefer not to speak
4. **Conversation History**: All messages are saved and can be downloaded
5. **Professional Voice**: Natural-sounding AI voice responses

### Usage

1. **Start a Call**:
   - Click the green phone button
   - Grant microphone permission when prompted
   - Start speaking naturally

2. **During the Call**:
   - Tara will guide you through the performance review process
   - Speak naturally - no need to press buttons
   - Or type messages in the text box

3. **End the Call**:
   - Click the red phone button to end
   - Download the transcript if needed

## Vapi Assistant Prompt

Tara is configured with this system prompt:

```
You are Tara, an HR performance review voice assistant for TalentSpotify.

Your role is to facilitate structured, fair three-way performance reviews among Employee, Manager, and yourself.

Follow this exact flow:
1. First, confirm both Employee and Manager are present
2. Collect Employee Name
3. Collect Employee ID
4. Collect Manager Name
5. Collect Manager ID
6. Confirm all details and allow corrections
7. Conduct the review in stages: Employee self-assessment, Manager feedback, Summary

Be professional, empathetic, and ensure both parties have equal opportunity to speak. Keep responses concise and clear.
```

## Customization

### Change Voice
Edit `src/services/vapiService.ts`:
```typescript
voice: {
  provider: 'openai' as const,
  voiceId: 'nova' as const // Options: alloy, echo, fable, onyx, nova, shimmer
}
```

### Change Model
```typescript
model: {
  provider: 'openai' as const,
  model: 'gpt-4-turbo' as const // or 'gpt-3.5-turbo'
}
```

### Update System Prompt
Modify the `content` field in the `messages` array in `vapiService.ts`.

## Troubleshooting

### No Audio
- Check microphone permissions in browser settings
- Ensure your system volume is not muted
- Try refreshing the page

### Call Won't Start
- Check browser console for errors
- Verify API keys in `.env` file
- Ensure you have internet connection

### Poor Recognition
- Speak clearly and at a normal pace
- Reduce background noise
- Check your microphone quality

## Browser Support
- ✅ Chrome (recommended)
- ✅ Edge
- ⚠️ Firefox (limited support)
- ⚠️ Safari (limited support)

## Next Steps

1. **Test the Integration**: Start a call and test the voice conversation
2. **Customize the Prompt**: Adjust Tara's behavior in `vapiService.ts`
3. **Add Features**: Extend the `useVapi` hook for additional functionality
4. **Monitor Usage**: Check your Vapi dashboard for usage statistics

## Support

For Vapi-specific issues, visit:
- [Vapi Documentation](https://docs.vapi.ai)
- [Vapi Dashboard](https://dashboard.vapi.ai)
