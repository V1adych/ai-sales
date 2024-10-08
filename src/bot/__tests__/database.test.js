const { initializeApp } = require("firebase/app");
const {
	getDatabase,
	ref,
	child,
	set,
	update,
	remove,
} = require("firebase/database");
const {
	addMessage,
	getMessages,
	resetUser,
	getItems,
	getIntents,
	getTriggers,
	addTrigger,
	getSystemPrompt,
	getForgottenChats,
} = require("../database");

const firebaseConfig = {
	apiKey: process.env.API_KEY,
	authDomain: process.env.AUTH_DOMAIN,
	databaseURL: process.env.DATABASE_URL,
	projectId: process.env.PROJECT_ID,
	storageBucket: process.env.STORAGE_BUCKET,
	messagingSenderId: process.env.MESSAGING_SENDER_ID,
	appId: process.env.APP_ID,
};

const CHATS_DB = "chatsTest/";
const ITEMS_DB = "itemsTest/";
const INTENTS_DB = "intentsTest/";
const TRIGGERS_DB = "triggersTest/";
const SYSTEM_PROMPT_DB = "systemPromptTest/";

jest.mock("../constants", () => {
	const originalModule = jest.requireActual("../constants");
	return {
		...originalModule,
		CHATS_DB: CHATS_DB,
		ITEMS_DB: ITEMS_DB,
		INTENTS_DB: INTENTS_DB,
		TRIGGERS_DB: TRIGGERS_DB,
		SYSTEM_PROMPT_DB: SYSTEM_PROMPT_DB,
	};
});

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

test("addMessage + getMessages + resetUser", async () => {
	const userId = "user123";
	const message = {
		role: "user",
		content: "Hello, World!",
	};

	await resetUser(db, userId);
	await addMessage(db, userId, message);
	const retrievedMessage = await getMessages(db, userId);

	expect(retrievedMessage).toEqual([message]);
	expect(retrievedMessage.length).toBe(1);

	await resetUser(db, userId);
	const retrievedMessage2 = await getMessages(db, userId);
	expect(retrievedMessage2).toEqual([]);
});

test("getItems", async () => {
	await set(child(ref(db), ITEMS_DB), []);
	const items = await getItems(db);
	expect(items).toEqual([]);

	await set(child(ref(db), `${ITEMS_DB}/0`), {
		name: "Item 1",
		description: "Description 1",
		id: 0,
	});

	const items2 = await getItems(db);
	expect(items2).toEqual([
		{
			name: "Item 1",
			description: "Description 1",
			id: 0,
		},
	]);
});

test("getIntents", async () => {
	await set(child(ref(db), INTENTS_DB), []);
	const intents = await getIntents(db);
	expect(intents).toEqual([]);

	await set(child(ref(db), `${INTENTS_DB}/0`), {
		name: "Intent 1",
		description: "Description 1",
		id: 0,
	});

	const intents2 = await getIntents(db);
	expect(intents2).toEqual([
		{
			name: "Intent 1",
			description: "Description 1",
			id: 0,
		},
	]);
});

test("getTriggers + addTrigger", async () => {
	await set(child(ref(db), TRIGGERS_DB), []);
	const triggers = await getTriggers(db);
	expect(triggers).toEqual([]);

	await addTrigger(db, "user123", "trigger");
	const triggers2 = await getTriggers(db);
	expect(triggers2).toEqual([{ userId: "user123", trigger: "trigger" }]);
});

test("getSystemPrompt", async () => {
	await set(child(ref(db), SYSTEM_PROMPT_DB), "");
	const systemPrompt = await getSystemPrompt(db);
	expect(systemPrompt).toEqual("");

	await set(child(ref(db), SYSTEM_PROMPT_DB), "Hello, World!");
	const systemPrompt2 = await getSystemPrompt(db);
	expect(systemPrompt2).toEqual("Hello, World!");
});

test("addMessage + getForgottenChats", async () => {
	await set(child(ref(db), CHATS_DB), {});
	const forgottenChats = await getForgottenChats(db);
	expect(forgottenChats).toEqual({});

	await addMessage(db, "user123", { role: "user", content: "Hello!" });
	const forgottenChats2 = await getForgottenChats(db);
	expect(forgottenChats2).toEqual({});

	const date = Date.now() - 60 * 60 * 1000;
	await update(child(ref(db), `${CHATS_DB}/user123`), {
		lastUpdate: date,
	});

	const forgottenChats3 = await getForgottenChats(db, 30 * 60 * 1000);
	expect(forgottenChats3).toEqual({
		user123: {
			lastUpdate: date,
			messages: [{ role: "user", content: "Hello!" }],
			reminderLast: false,
		},
	});

	await update(child(ref(db), `${CHATS_DB}/user123`), {
		reminderLast: true,
	});
	const forgottenChats4 = await getForgottenChats(db);
	expect(forgottenChats4).toEqual({});
});

afterAll(() => {
	for (const dbKey of [
		CHATS_DB,
		ITEMS_DB,
		INTENTS_DB,
		TRIGGERS_DB,
		SYSTEM_PROMPT_DB,
	]) {
		remove(child(ref(db), dbKey));
	}
});
