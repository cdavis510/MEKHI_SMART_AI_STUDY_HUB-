exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Missing GEMINI_API_KEY (or GOOGLE_GEMINI_API_KEY / GOOGLE_API_KEY) in Netlify environment variables"
        })
      };
    }

    const { className, assignmentTitle, assignmentText } = JSON.parse(event.body || "{}");

    if (!assignmentText) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing assignmentText" })
      };
    }

    const prompt = `Class: ${className || ""}
Assignment: ${assignmentTitle || ""}

Assignment details:
${assignmentText}

Help with this assignment. Give:
1. what the assignment is asking
2. the first steps
3. a simple outline or work plan
4. what to turn in
5. a short checklist`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: data.error?.message || "Gemini request failed",
          details: data
        })
      };
    }

    const result =
      data.candidates?.[0]?.content?.parts?.map(p => p.text).join("\\n").trim() || "";

    return {
      statusCode: 200,
      body: JSON.stringify({ result })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};