import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-648c7146/health", (c) => {
  return c.json({ status: "ok" });
});

// Sign up endpoint
app.post("/make-server-648c7146/signup", async (c) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { email, password, name, avatar } = await c.req.json();

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, avatar },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log(`Sign up error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Store user profile in KV store
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      avatar,
      latitude: null,
      longitude: null,
      lastSeen: new Date().toISOString()
    });

    return c.json({ success: true, user: data.user });
  } catch (error) {
    console.log(`Sign up error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Update user location
app.post("/make-server-648c7146/update-location", async (c) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (!user) {
      console.log(`Update location unauthorized: ${authError?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { latitude, longitude } = await c.req.json();

    // Get existing user data
    const userData = await kv.get(`user:${user.id}`);
    
    if (userData) {
      userData.latitude = latitude;
      userData.longitude = longitude;
      userData.lastSeen = new Date().toISOString();
      await kv.set(`user:${user.id}`, userData);
    }

    return c.json({ success: true });
  } catch (error) {
    console.log(`Update location error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Get nearby users
app.get("/make-server-648c7146/nearby-users", async (c) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (!user) {
      console.log(`Get nearby users unauthorized: ${authError?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get all users
    const allUsers = await kv.getByPrefix('user:');
    
    // Filter out current user and users without location
    const nearbyUsers = allUsers
      .filter((u: any) => u.id !== user.id && u.latitude && u.longitude)
      .map((u: any) => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        latitude: u.latitude,
        longitude: u.longitude,
        lastSeen: u.lastSeen
      }));

    return c.json({ users: nearbyUsers });
  } catch (error) {
    console.log(`Get nearby users error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Send message
app.post("/make-server-648c7146/send-message", async (c) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (!user) {
      console.log(`Send message unauthorized: ${authError?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { recipientId, message } = await c.req.json();

    // Create a conversation key (sorted IDs for consistency)
    const conversationId = [user.id, recipientId].sort().join(':');
    const messageKey = `message:${conversationId}:${Date.now()}`;

    const messageData = {
      senderId: user.id,
      recipientId,
      message,
      timestamp: new Date().toISOString()
    };

    await kv.set(messageKey, messageData);

    return c.json({ success: true, message: messageData });
  } catch (error) {
    console.log(`Send message error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Get messages for a conversation
app.get("/make-server-648c7146/get-messages/:recipientId", async (c) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (!user) {
      console.log(`Get messages unauthorized: ${authError?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const recipientId = c.req.param('recipientId');
    const conversationId = [user.id, recipientId].sort().join(':');

    // Get all messages for this conversation
    const messages = await kv.getByPrefix(`message:${conversationId}`);
    
    // Sort by timestamp
    messages.sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return c.json({ messages });
  } catch (error) {
    console.log(`Get messages error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

Deno.serve(app.fetch);
