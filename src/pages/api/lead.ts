export const prerender = false;

import type { APIRoute } from 'astro';

const NOTION_API_KEY = import.meta.env.NOTION_API_KEY;
const NOTION_DB_ID = import.meta.env.NOTION_LEAD_CAPTURES_DB_ID;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { name, email, resource, url } = await request.json();

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'Name and email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!NOTION_API_KEY || !NOTION_DB_ID) {
      console.error('Missing NOTION_API_KEY or NOTION_LEAD_CAPTURES_DB_ID env vars');
      return new Response(JSON.stringify({ error: 'Server config error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DB_ID },
        properties: {
          'Name': { title: [{ text: { content: name } }] },
          'Email': { email: email },
          'Resource': { rich_text: [{ text: { content: resource || '' } }] },
          'Source URL': { url: url || null },
          'Status': { select: { name: 'New' } },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Notion API error:', err);
      return new Response(JSON.stringify({ error: 'Failed to save lead' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Lead capture error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
