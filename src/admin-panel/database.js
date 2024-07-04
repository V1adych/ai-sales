const bcrypt = require("bcrypt");
const { ref, update, get, child } = require("firebase/database");
const { ADMINS_DB, SESSIONS_DB, SESSION_TIMEOUT } = require("./constants");
const { getEmbedding } = require("../bot/api");
const { getProducts, getIntents } = require("../bot/database");
const {
	PRODUCTS_DB,
	INTENTS_DB,
	SYSTEM_PROMPT_DB,
	VECTOR_DB_NAMESPACE,
} = require("../bot/constants");

/**
 * Adds a new product to the database.
 *
 * @param {string} name - The name of the product.
 * @param {string} description - The description of the product.
 * @param {number} price - The price of the product.
 * @param {object} database - The Firebase Realtime Database reference.
 * @param {object} [index=null] - The vector database index.
 * @return {Promise<number>} Returns 0 if the product was added successfully, or 1 if an error occurred.
 */
async function addProduct(name, description, price, database, index = null) {
	dbRef = ref(database);
	try {
		products = await getProducts(database);
		id = 0;
		for (i = 0; i < products.length; i++) {
			const product = products[i];
			id = Math.max(id, product.id + 1);
		}
		products.push({
			name: name,
			description: description,
			price: price,
			id: id,
		});
		await update(dbRef, { [PRODUCTS_DB]: products });
		if (index !== null) {
			await index.namespace(VECTOR_DB_NAMESPACE).deleteOne(String(id));
			await index.namespace(VECTOR_DB_NAMESPACE).upsert([
				{
					id: String(id),
					values: await getEmbedding(
						JSON.stringify(products[i]),
						process.env.EMBEDDING_MODEL,
						process.env.GEMINI_TOKEN,
						process.env.PROXY_URL,
					),
					metadata: {
						name: name,
						description: description,
						id: id,
						price: price,
					},
				},
			]);
		}
		return 0;
	} catch (error) {
		console.error("Error adding new product:", error);
		return 1;
	}
}

/**
 * Updates a product in the database.
 *
 * @param {string} name - The new name of the product.
 * @param {string} description - The new description of the product.
 * @param {number} price - The new price of the product.
 * @param {number} id - The ID of the product to be updated.
 * @param {object} database - The Firebase Realtime Database reference.
 * @param {object} [index=null] - The vector database index.
 * @return {Promise<number>} Returns 0 if the product was updated successfully, or 1 if an error occurred.
 */
async function updateProduct(
	name,
	description,
	price,
	id,
	database,
	index = null,
) {
	dbRef = ref(database);
	try {
		code = 1;
		products = await getProducts(database);
		updatedProduct = null;
		for (i = 0; i < products.length; i++) {
			if (products[i].id === id) {
				products[i].name = name;
				products[i].description = description;
				products[i].price = price;
				updatedProduct = products[i];
				code = 0;
				break;
			}
		}
		await update(dbRef, { [PRODUCTS_DB]: products });
		if (index != null && updateProduct != null) {
			const vector = await getEmbedding(
				JSON.stringify(updatedProduct),
				process.env.EMBEDDING_MODEL,
				process.env.GEMINI_TOKEN,
				process.env.PROXY_URL,
			)
			await index.namespace(VECTOR_DB_NAMESPACE).deleteOne(String(id));
			await index.namespace(VECTOR_DB_NAMESPACE).upsert([
				{
					id: String(id),
					values: vector,
					metadata: {
						name: name,
						description: description,
						id: id,
						price: price,
					},
				},
			]);
		}
		return code;
	} catch (error) {
		console.error("Error updating product:", error);
		return 1;
	}
}

/**
 * Deletes a product from the database based on the provided ID.
 *
 * @param {number} id - The ID of the product to be deleted.
 * @param {object} database - The Firebase Realtime Database reference.
 * @param {object} [index=null] - The vector database index.
 * @return {Promise<number>} Returns 0 if the product was deleted successfully, or 1 if an error occurred.
 */
async function deleteProduct(id, database, index = null) {
	dbRef = ref(database);
	try {
		code = 1;
		products = await getProducts(database);
		newProducts = [];
		for (i = 0; i < products.length; i++) {
			if (products[i].id === id) {
				code = 0;
				continue;
			}
			newProducts.push(products[i]);
		}
		await update(dbRef, { [PRODUCTS_DB]: newProducts });
		if (index != null) {
			await index.namespace(VECTOR_DB_NAMESPACE).deleteOne(String(id));
		}
		return code;
	} catch (error) {
		console.error("Error deleting product:", error);
		return 1;
	}
}

/**
 * Adds an intent to the database with the given name and description.
 *
 * @param {string} name - The name of the intent.
 * @param {string} description - The description of the intent.
 * @param {object} database - The Firebase Realtime Database reference.
 * @return {Promise<number>} Returns 0 if the intent was added successfully, or 1 if an error occurred.
 */
async function addIntent(name, description, database) {
	dbRef = ref(database);
	try {
		const snapshot = await get(child(dbRef, INTENTS_DB));
		const intents = snapshot.val() || [];
		code = 1;
		newId = 0;
		for (i = 0; i < intents.length; i++) {
			const intent = intents[i];
			newId = Math.max(newId, intent.id + 1);
		}
		intents.push({ name: name, description: description, id: newId });
		await update(dbRef, { [INTENTS_DB]: intents });
		return 0;
	} catch (error) {
		console.error("Error adding intent:", error);
		return 1;
	}
}

/**
 * Updates an intent in the database with the given name, description, and id.
 *
 * @param {string} name - The new name of the intent.
 * @param {string} description - The new description of the intent.
 * @param {number} id - The id of the intent to update.
 * @param {object} database - The Firebase Realtime Database reference.
 * @return {Promise<number>} Returns 0 if the intent was updated successfully, or 1 if an error occurred.
 */
async function updateIntent(name, description, id, database) {
	dbRef = ref(database);
	try {
		code = 1;
		intents = await getIntents(database);
		for (i = 0; i < intents.length; i++) {
			if (intents[i].id === id) {
				intents[i].name = name;
				intents[i].description = description;
				code = 0;
			}
		}
		await update(dbRef, { [INTENTS_DB]: intents });
		return code;
	} catch (error) {
		console.error("Error updating intent:", error);
		return 1;
	}
}

/**
 * Deletes an intent from the database.
 *
 * @param {number} id - The id of the intent to delete.
 * @param {object} database - The Firebase Realtime Database reference.
 * @return {Promise<number>} Returns 0 if the intent was deleted successfully, or 1 if an error occurred.
 */
async function deleteIntent(id, database) {
	dbRef = ref(database);
	try {
		code = 1;
		intents = await getIntents(database);
		newIntents = [];
		for (i = 0; i < intents.length; i++) {
			if (intents[i].id === id) {
				code = 0;
				continue;
			}
			newIntents.push(intents[i]);
		}
		await update(dbRef, { [INTENTS_DB]: newIntents });
		return code;
	} catch (error) {
		console.error("Error deleting intent:", error);
		return 1;
	}
}

/**
 * Checks if the given username and password match any admin credentials in the database.
 *
 * @param {string} username - The username to check.
 * @param {string} password - The password to check.
 * @param {object} database - The Firebase Realtime Database reference.
 * @return {Promise<boolean>} Returns true if the username and password match an admin credential, false otherwise.
 */
async function checkAdmin(username, password, database) {
	dbRef = ref(database);
	try {
		const snapshot = await get(child(dbRef, ADMINS_DB));
		if (snapshot.exists()) {
			const admins = snapshot.val() || [];
			for (i = 0; i < admins.length; i++) {
				if (
					username === admins[i].username &&
					bcrypt.compareSync(password, admins[i].password)
				) {
					return true;
				}
			}
			return false;
		}
		return false;
	} catch (error) {
		console.error("Error checking admin:", error);
		return false;
	}
}

/**
 * Retrieves the sessions from the database.
 *
 * @param {object} database - The Firebase Realtime Database reference.
 * @return {Promise<Array<object>>} Returns an array of session objects or an empty array if no sessions exist.
 */
async function getSessions(database) {
	dbRef = ref(database);
	try {
		const snapshot = await get(child(dbRef, SESSIONS_DB));
		if (snapshot.exists()) {
			return snapshot.val() || [];
		}
		return [];
	} catch (error) {
		console.error("Error fetching sessions:", error);
		return [];
	}
}

/**
 * Adds a session to the database.
 *
 * @param {string} username - The username of the session.
 * @param {string} sessionId - The session ID.
 * @param {number} expirationTimestamp - The expiration timestamp of the session.
 * @param {object} database - The Firebase Realtime Database reference.
 * @return {number} Returns 1 upon successful addition of the session.
 */
async function addSession(username, sessionId, expirationTimestamp, database) {
	dbRef = ref(database);
	try {
		sessions = await getSessions(database);
		sessions.push({
			username: username,
			sessionId: bcrypt.hashSync(sessionId, 1),
			expirationTimestamp: expirationTimestamp,
		});
		await update(dbRef, { [SESSIONS_DB]: sessions });
		return 1;
	} catch (error) {
		console.error("Error adding session:", error);
		return 1;
	}
}

/**
 * Extends the session expiration timestamp for a given user.
 *
 * @param {string} username - The username of the session to extend.
 * @param {string} sessionId - The session ID of the session to extend.
 * @param {object} database - The Firebase Realtime Database reference.
 * @return {number} Returns 1 upon successful extension of the session.
 */
async function extendSession(username, sessionId, database) {
	dbRef = ref(database);
	try {
		sessions = await getSessions(database);
		newSessions = [];
		const curTimestamp = Date.now();
		for (i = 0; i < sessions.length; i++) {
			if (
				sessions[i].username === username &&
				bcrypt.compareSync(sessionId, sessions[i].sessionId)
			) {
				sessions[i].expirationTimestamp = curTimestamp + SESSION_TIMEOUT;
			}
			if (sessions[i].expirationTimestamp > curTimestamp) {
				newSessions.push(sessions[i]);
			}
		}
		await update(dbRef, { [SESSIONS_DB]: newSessions });
		return 1;
	} catch (error) {
		console.error("Error extending session:", error);
		return 1;
	}
}

/**
 * Checks if a session is valid for a given username and session ID.
 *
 * @param {string} username - The username associated with the session.
 * @param {string} sessionId - The session ID to check.
 * @param {object} database - The Firebase Realtime Database reference.
 * @return {Promise<boolean>} A promise that resolves to true if the session is valid, false otherwise.
 */
async function checkSession(username, sessionId, database) {
	dbRef = ref(database);
	curTimestamp = Date.now();
	try {
		snapshot = await get(child(dbRef, SESSIONS_DB));
		sessions = [];
		if (snapshot.exists()) {
			sessions = snapshot.val() || [];
		}
		newSessions = [];
		auth = false;
		for (i = 0; i < sessions.length; i++) {
			if (sessions[i].expirationTimestamp <= curTimestamp) {
				continue;
			}
			newSessions.push(sessions[i]);
			if (
				sessions[i].username === username &&
				bcrypt.compareSync(sessionId, sessions[i].sessionId)
			) {
				auth = true;
			}
		}
		await update(dbRef, { [SESSIONS_DB]: newSessions });
		return auth;
	} catch (error) {
		console.error("Error checking session:", error);
		return false;
	}
}

/**
 * Generates a random alphanumeric ID of a specified length.
 *
 * @param {number} [length=10] - The length of the generated ID.
 * @return {string} The randomly generated alphanumeric ID.
 */
function generateRandomId(length = 10) {
	return Math.random()
		.toString(36)
		.substring(2, length + 2);
}

/**
 * Updates the system prompt in the database.
 *
 * @param {string} prompt - The new system prompt.
 * @param {object} database - The Firebase Realtime Database reference.
 * @return {Promise<number>} Returns 0 if the system prompt is successfully updated, 1 if there was an error.
 */
async function updateSystemPrompt(prompt, database) {
	dbRef = ref(database);
	try {
		await update(dbRef, { [SYSTEM_PROMPT_DB]: prompt });
		return 0;
	} catch (error) {
		console.error("Error updating system prompt:", error);
		return 1;
	}
}

/**
 * Checks the authentication status of a request.
 *
 * @param {Object} req - The request object.
 * @param {Object} database - The database object.
 * @return {Promise<boolean>} A Promise that resolves to a boolean indicating the authentication status.
 */
async function checkReqAuth(req, database) {
	const username = req.cookies.username;
	const sessionId = req.cookies.sessionId;
	const auth = await checkSession(username, sessionId, database);
	return auth;
}

/**
 * Updates the vector database by deleting all existing vectors and re-inserting new vectors based on the products in the database.
 *
 * @param {Object} database - The database object.
 * @param {Object} index - The index object.
 * @return {Promise<void>} A Promise that resolves when the vector database is updated.
 */
async function updateVectorDatabase(database, index) {
	const products = await getProducts(database);
	try {
		index.namespace(VECTOR_DB_NAMESPACE).deleteAll();
	} catch (error) {
		console.error("Error deleting vector database:", error);
	}

	for (i = 0; i < products.length; i++) {
		const product = products[i];
		const vector = await getEmbedding(
			JSON.stringify(product),
			process.env.EMBEDDING_MODEL,
			process.env.GEMINI_TOKEN,
			process.env.PROXY_URL,
		);
		index
			.namespace(VECTOR_DB_NAMESPACE)
			.upsert([{ id: String(product.id), values: vector, metadata: product }]);
	}
}
module.exports = {
	addProduct,
	updateProduct,
	deleteProduct,
	addIntent,
	updateIntent,
	deleteIntent,
	checkAdmin,
	getSessions,
	addSession,
	extendSession,
	checkSession,
	generateRandomId,
	updateSystemPrompt,
	checkReqAuth,
	updateVectorDatabase,
};
