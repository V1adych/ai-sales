require("dotenv").config();
const WhatsAppBot = require("@green-api/whatsapp-bot");
const { initializeApp } = require("firebase/app");
const { getDatabase } = require("firebase/database");
const { getGeminiResponse, getUserIntent } = require("./api");
const {
  HELP_MESSAGE,
  RESET_MESSAGE,
  SYSTEM_MESSAGE,
  CLASSIFIER_MESSAGE,
} = require("./constants");
const {
  resetUser,
  getMessages,
  addMessage,
  getProducts,
  addTrigger,
  getIntents,
  getSystemPrompt,
} = require("./database");

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  databaseURL: process.env.DATABASE_URL,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
};

app = initializeApp(firebaseConfig);
database = getDatabase(app);

function squeezeMessages(
  messages,
  maxSequenceLength = 30,
  maxMessageLength = 500
) {
  messages = messages.slice(-maxSequenceLength);
  for (i = 0; i < messages.length; i++) {
    content = messages[i]["content"];
    if (content.length > maxMessageLength) {
      messages[i]["content"] =
        content.substring(content.length - maxMessageLength) + "...";
    }
  }
  return messages;
}

function checkTrigger(messageResponse, intentResponse, intents) {
  if (
    messageResponse.toLowerCase().includes("thank") &&
    messageResponse.toLowerCase().includes("purchase")
  ) {
    return "purchase";
  }

  foundIntent = null;
  intents.forEach((intent) => {
    if (intentResponse.toLowerCase().includes(intent["name"].toLowerCase())) {
      foundIntent = intent["name"];
    }
  });

  return foundIntent;
}

function stringToJson(inputString) {
  const jsonRegex = /{[^{}]*}/;
  const match = inputString.match(jsonRegex);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return null;
    }
  } else {
    console.error("No JSON found in the input string");
    return null;
  }
}

const bot = new WhatsAppBot({
  idInstance: process.env.ID_INSTANCE,
  apiTokenInstance: process.env.API_TOKEN_INSTANCE,
});

bot.command("reset", async (ctx) => {
  const userId = ctx.update.message.chat.id;
  await resetUser(database, userId);
  await ctx.reply(RESET_MESSAGE);
});

bot.command("start", async (ctx) => {
  const userId = ctx.update.message.chat.id;
  await resetUser(database, userId, [
    { role: "assistant", content: HELP_MESSAGE },
  ]);
  await ctx.reply(HELP_MESSAGE);
});

bot.command("help", async (ctx) => {
  await ctx.reply(HELP_MESSAGE);
});

bot.on("message", async (ctx) => {
  const userId = ctx.update.message.chat.id;
  await addMessage(database, userId, {
    role: "user",
    content: ctx.update.message.text,
  });
  messages = await getMessages(database, userId);
  messages = squeezeMessages(messages);
  try {
    const systemPrompt = await getSystemPrompt(database);
    const products = await getProducts(database);
    const intents = await getIntents(database);
    const intent = await getUserIntent(
      messages,
      intents,
      CLASSIFIER_MESSAGE,
      process.env.GEMINI_MODEL,
      process.env.GEMINI_TOKEN,
      process.env.PROXY_URL
    );

    const message = await getGeminiResponse(
      messages,
      process.env.GEMINI_MODEL,
      process.env.GEMINI_TOKEN,
      process.env.PROXY_URL,
      systemPrompt + "\nProducts:\n" + JSON.stringify(products)
    );

    const trigger = checkTrigger(message, intent, intents);
    if (trigger != null) {
      await addTrigger(database, userId, trigger);
      await ctx.reply("TRIGGER ACTIVATED");
      return;
    }

    await addMessage(database, userId, {
      role: "assistant",
      content: message,
    });

    await ctx.reply(message);
  } catch (error) {
    console.error("Error getting response:", error);

    await addMessage(database, userId, {
      role: "assistant",
      content: "Sorry, an error occurred",
    });

    await ctx.reply("Sorry, an error occurred");
  }
});

bot.launch();
