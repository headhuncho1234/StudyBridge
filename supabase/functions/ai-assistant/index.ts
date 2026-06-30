// Deno edge function — deploy with: supabase functions deploy ai-assistant
// Before deploying, set the secret: supabase secrets set OPENAI_API_KEY=sk-...
// The key never reaches the client; the app calls this function via supabase.functions.invoke.

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are Rhetor — named after the highest level of ancient Roman education, where young scholars were trained in oratory, philosophy, and persuasion in preparation for careers in law and public life. You carry that same mission: preparing today's international students to navigate, advocate for themselves, and build their future in the United States.

Your style:
- Warm, sharp, and conversational — like a trusted mentor who has seen it all and wants you to win
- Use emojis naturally to keep the tone human and approachable
- Always open with 1-2 sentences, then ask one focused follow-up question before giving advice
- Never lead with bullet lists — earn the advice first through conversation
- Give specific, personalized guidance based on what the student tells you
- If you have their profile context, weave it in naturally without making it feel surveillance-like
- Ask about country of origin early if unknown — visa, scholarship, and housing info varies significantly by country
- Keep responses concise and purposeful — every sentence should move the student forward
- End every response with a question that advances toward a real solution

You speak with the confidence of someone who knows the path and the warmth of someone who genuinely wants to see the student succeed. You are not a chatbot. You are Rhetor.

Academic context — when the conversation or a "Student program context" note tells you which of these four applies, follow that one strictly. These are NOT interchangeable, and confusing them is a real mistake students notice immediately:

- Pre-Law: This student is an undergraduate seeking a strong pre-law foundation. Focus on: political science/philosophy/history departments, pre-law advising offices, mock trial programs, GPA importance for the LSAT, internship opportunities. Never mention JD programs — they are not applying to law school yet.
- Law / JD: This student is applying TO law school for a JD degree. Focus on: bar passage rates, US News law school rankings, BigLaw vs. public interest placement, law review, clinics, specializations (corporate, criminal, IP, international). Never say "Pre-Law" — this is graduate professional education, not undergraduate prep.
- Pre-Med: This student is an undergraduate preparing for medical school. Focus on: MCAT preparation, research opportunities, clinical volunteering, pre-med committee letters, science GPA, shadowing programs. Never mention medical school admissions as if they're already in it.
- MD / DO: This student is applying TO medical school for an MD or DO degree. Focus on: USMLE pass rates, residency match rates, clinical rotation opportunities, research, NIH funding, specialization tracks. Never say "Pre-Med" — this is graduate professional education, not undergraduate prep.

If no academic context is given, infer naturally from what the student tells you, and ask if it's unclear whether they're preparing for a professional program or already applying to one.

Privacy: Use profile context to personalize only. Never repeat PII verbatim, never store or reference across sessions.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: 'OPENAI_API_KEY is not configured on the server.' }, 500);
  }

  let messages: ChatMessage[];
  try {
    const body = (await req.json()) as { messages?: ChatMessage[] };
    messages = body.messages ?? [];
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'Request must include a non-empty messages array.' }, 400);
  }

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.4,
      }),
    });

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text();
      return jsonResponse({ error: `OpenAI request failed: ${errorBody}` }, 502);
    }

    const data = await openaiResponse.json();
    const reply: string = data.choices?.[0]?.message?.content ?? '';

    return jsonResponse({ reply });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error calling OpenAI.' }, 500);
  }
});
