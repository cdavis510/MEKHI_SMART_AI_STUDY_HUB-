exports.handler = async function () {
  try {
    const baseUrl = process.env.CANVAS_BASE_URL;
    const apiKey = process.env.CANVAS_API_KEY;

    if (!baseUrl) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing CANVAS_BASE_URL in Netlify environment variables" })
      };
    }

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing CANVAS_API_KEY in Netlify environment variables" })
      };
    }

    const coursesRes = await fetch(
      `${baseUrl}/api/v1/courses?enrollment_state=active&state[]=available&per_page=50`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    );

    const coursesData = await coursesRes.json();

    if (!coursesRes.ok) {
      return {
        statusCode: coursesRes.status,
        body: JSON.stringify({
          error: coursesData.errors?.[0]?.message || "Canvas courses request failed",
          details: coursesData
        })
      };
    }

    const realCourses = (Array.isArray(coursesData) ? coursesData : []).filter(
      c => c && c.id && !c.access_restricted_by_date
    );

    const assignmentGroups = await Promise.all(
      realCourses.slice(0, 10).map(async (course) => {
        const assignRes = await fetch(
          `${baseUrl}/api/v1/courses/${course.id}/assignments?bucket=upcoming&bucket=overdue&per_page=50`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`
            }
          }
        );

        const assignData = await assignRes.json();
        if (!assignRes.ok) return [];

        return (Array.isArray(assignData) ? assignData : []).map(a => {
          const due = a.due_at || "";
          const isPastDue = due ? new Date(due).getTime() < Date.now() : false;
          const descriptionText = typeof a.description === "string"
            ? a.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            : "";

          return {
            id: a.id,
            course: course.name || course.course_code || "Course",
            name: a.name || "Assignment",
            due_at: due ? new Date(due).toLocaleString() : "",
            status: isPastDue ? "past_due" : "current",
            description: descriptionText
          };
        });
      })
    );

    const assignments = assignmentGroups.flat().sort((a, b) => {
      const da = Date.parse(a.due_at || "") || Number.MAX_SAFE_INTEGER;
      const db = Date.parse(b.due_at || "") || Number.MAX_SAFE_INTEGER;
      return da - db;
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ assignments })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};