import { getOpenAI, getModel } from '../client';

export async function describeImage(imageBase64OrUrl: string): Promise<string> {
    const openai = getOpenAI();
    const model = getModel('describe_image');

    // If it's a data URL or http URL, use it as is.
    // If it's raw base64, prepend the data URI scheme.
    let imageUrl = imageBase64OrUrl;
    if (!imageBase64OrUrl.startsWith('http') && !imageBase64OrUrl.startsWith('data:')) {
        imageUrl = `data:image/jpeg;base64,${imageBase64OrUrl}`;
    }

    try {
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Describe this image in detail. Focus on any potentially inappropriate content or safety concerns.' },
                        {
                            type: 'image_url',
                            image_url: {
                                "url": imageUrl,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 300,
        });

        return response.choices[0].message.content || 'No description available.';
    } catch (error) {
        console.error('Error describing image:', error);
        throw error;
    }
}
