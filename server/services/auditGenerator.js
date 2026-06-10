// Using OpenAI GPT-4
async function callOpenAI(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

const LENS_DESCRIPTIONS = {
  rhythm: 'How does the song use drums, bass, and groove? Where do the kicks sit? How do the hats breathe? What is the pocket and feel?',
  texture: 'What are all the distinct textures and timbres? How is EQ used? What reverb and delays create space and depth? What is the surface feel?',
  harmony: 'What chords and progressions are used? Are there borrowed chords? Modal shifts? How does harmony move throughout?',
  arrangement: 'How is the song structured? What sections exist? How do transitions work? What instruments enter/exit? How does energy build?',
};

export async function generateAuditTemplate(songTitle, artist, researchSummary, lenses) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return generateFallbackTemplate(songTitle, artist, lenses);
    }

    const lensDescriptions = lenses
      .map((lens) => `- ${lens}: ${LENS_DESCRIPTIONS[lens]}`)
      .join('\n');

    const prompt = `You are a music production expert specializing in detailed song analysis using the "Arra" methodology.

Song: "${songTitle}" by ${artist}
Research Context: ${researchSummary || 'No research available'}

Create a customized audit questionnaire for studying this song through these lenses:
${lensDescriptions}

Generate 4-6 focused, open-ended questions for EACH selected lens. Questions should:
1. Be actionable (something the listener can do while studying)
2. Reference specific musical techniques
3. EncouraresponseText = await callOpenAI(prompt);
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Could not parse JSON from OpenAI
      "questions": [list of 4-6 questions]
    },
    "arrangement": {
      "description": "short description",
      "questions": [list of 4-6 questions]
    }
  },
  "workflow_guidance": "Brief guidance on how to approach this audit"
}

Only include the lenses specified: ${lenses.join(', ')}`;

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Parse response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Could not parse JSON from Claude response');
      return generateFallbackTemplate(songTitle, artist, lenses);
    }

    const template = JSON.parse(jsonMatch[0]);
    return template;
  } catch (error) {
    console.error('Audit template generation error:', error.message);
    return generateFallbackTemplate(songTitle, artist, lenses);
  }
}

function generateFallbackTemplate(songTitle, artist, lenses) {
  const template = {
    title: `Arra Audit: ${songTitle}`,
    artist: artist,
    lenses: {},
    workflow_guidance: 'Listen to the song multiple times, focusing on one lens at a time. Take notes and sketch what you hear.',
  };

  const defaultQuestions = {
    rhythm: [
      'Where does the kick drum sit relative to the beat? Is it locked to the grid or does it push/pull?',
      'How would you describe the groove feel? Is it straight, swinging, or loose?',
      'What is the main hi-hat pattern? How does it interact with the kick?',
      'Are there any ghost notes, fills, or rhythmic variations in the drums?',
      'How does the bass interact with the kick drum? Is there a pocket you can identify?',
      'If you had to transcribe the drum pattern, what would be the key moments or syncopations?',
    ],
    texture: [
      'List all the distinct textures you hear. What would you call each one (e.g., "shimmery pad," "gritty synth")?',
      'How is EQ used? What frequencies feel emphasized or scooped?',
      'What reverb and delays are present? How do they create space and depth?',
      'Is there a "close" version (dry) and a "far" version (wet/reverb) of any sounds?',
      'What is the overall brightness or darkness of the mix?',
      'Can you recreate 2-3 key textures using basic synths or effects?',
    ],
    harmony: [
      'What is the primary chord progression? Can you map it in Roman numerals?',
      'Are there any borrowed chords or unexpected harmonic moves?',
      'What is the tonal center? Does it ever shift or become ambiguous?',
      'How does the bass line move in relation to the harmony?',
      'Where does tension build and resolve?',
      'Write out the progression in a simple chart, marking tensions and resolutions.',
    ],
    arrangement: [
      'Sketch a timeline of the song. Where are the main sections (intro, verse, chorus, bridge)?',
      'What instruments play in each section? When do new layers enter or drop out?',
      'How do transitions between sections work? What creates the "turn"?',
      'Is there a build or development throughout the song?',
      'What is the "hook" or most memorable moment, and how is it arranged?',
      'If you rebuilt this song, what arrangement "tricks" would you borrow?',
    ],
  };

  lenses.forEach((lens) => {
    template.lenses[lens] = {
      description: LENS_DESCRIPTIONS[lens],
      questions: defaultQuestions[lens] || [],
    };
  });

  return template;
}

export default { generateAuditTemplate };
