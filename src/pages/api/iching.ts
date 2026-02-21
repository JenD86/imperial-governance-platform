import type { NextApiRequest, NextApiResponse } from 'next';

interface IChingRequest {
  question: string;
  userId: string;
  language: string;
}

interface IChingResponse {
  hexagram?: {
    number: number;
    name: string;
    chineseName: string;
    description: string;
  };
  interpretation?: string;
  advice?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IChingResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, userId, language }: IChingRequest = req.body;

  if (!question || !userId) {
    return res.status(400).json({ error: 'Question and userId are required' });
  }

  try {
    const requestPayload = {
      question: question.trim(),
      userId,
      language: language || 'en'
    };

    console.log('🏛️ I Ching API Request:', JSON.stringify(requestPayload, null, 2));

    const response = await fetch('https://fortunerunners.com/iching/ask', {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform and validate the response
    const iChingResponse: IChingResponse = {
      hexagram: {
        number: data.hexagram?.number || Math.floor(Math.random() * 64) + 1,
        name: data.hexagram?.name || 'The Oracle Speaks',
        chineseName: data.hexagram?.chineseName || '神谕',
        description: data.hexagram?.description || 'Your offering has been received by the ancestors.'
      },
      interpretation: data.interpretation || 'The burning of tokens creates a bridge between the material and spiritual realms. Your sacrifice has been acknowledged.',
      advice: data.advice || 'In times of uncertainty, remember that loss can lead to wisdom, and sacrifice can bring clarity.'
    };

    res.status(200).json(iChingResponse);
    
  } catch (error) {
    console.error('I Ching API error:', error);
    
    // Provide fallback reading if API fails
    res.status(200).json({
      hexagram: {
        number: Math.floor(Math.random() * 64) + 1,
        name: 'The Oracle Speaks',
        chineseName: '神谕',
        description: 'Your offering has been received by the ancestors.'
      },
      interpretation: 'The burning of tokens creates a bridge between the material and spiritual realms. Your sacrifice has been acknowledged.',
      advice: 'In times of uncertainty, remember that loss can lead to wisdom, and sacrifice can bring clarity.'
    });
  }
}
