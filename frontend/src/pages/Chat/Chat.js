import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaEdit, FaPlus, FaRobot, FaTelegramPlane, FaTrash, FaUserCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import axios from "axios";
import "./Chat.css";

const DEFAULT_SESSION_TITLE = "New conversation";

export default function ChatPage() {
const LEGACY_DEFAULT_TITLES = [
	"new chat",
	DEFAULT_SESSION_TITLE.toLowerCase(),
	"cuộc trò chuyện mới",
];
	const [messages, setMessages] = useState([]);
	const [sessions, setSessions] = useState([]);
	const [activeSessionId, setActiveSessionId] = useState(null);
	const [input, setInput] = useState("");
	const [statusText, setStatusText] = useState("");
	const [sending, setSending] = useState(false);
	const [sessionsLoading, setSessionsLoading] = useState(true);
	const [messagesLoading, setMessagesLoading] = useState(false);
	const [displayName, setDisplayName] = useState(() => {
		const persisted = localStorage.getItem("chat_display_name");
		if (persisted) return persisted;
		try {
			const storedUser = JSON.parse(localStorage.getItem("user")) || {};
			return storedUser.username || "Traveler";
		} catch (error) {
			return "Traveler";
		}
	});
	const messagesEndRef = useRef(null);

	const token = localStorage.getItem("access_token");

	useEffect(() => {
		localStorage.setItem("chat_display_name", displayName);
	}, [displayName]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages, statusText]);

	const fetchSessions = useCallback(async () => {
		if (!token) {
			toast.error("Please sign in to continue.");
			return;
		}
		try {
			const res = await axios.get("/api/chat/sessions", {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = res.data || [];
			setSessions(data);
			setActiveSessionId((prev) => {
				if (prev && data.some((session) => session.id === prev)) {
					return prev;
				}
				return data[0]?.id || null;
			});
		} catch (error) {
			console.error("Cannot load chat sessions", error);
			toast.error("Unable to load chat history.");
		} finally {
			setSessionsLoading(false);
		}
	}, [token]);

	const fetchMessages = useCallback(
		async (sessionId) => {
			if (!token || !sessionId) {
				setMessages([]);
				return;
			}
			setMessagesLoading(true);
			try {
				const res = await axios.get(`/api/chat/sessions/${sessionId}/messages`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				setMessages(res.data || []);
			} catch (error) {
				console.error("Cannot load session messages", error);
				toast.error("Unable to load messages for this chat.");
			} finally {
				setMessagesLoading(false);
			}
		},
		[token]
	);

	useEffect(() => {
		fetchSessions();
	}, [fetchSessions]);

	useEffect(() => {
		if (activeSessionId) {
			fetchMessages(activeSessionId);
		} else {
			setMessages([]);
		}
	}, [activeSessionId, fetchMessages]);

	const createSession = useCallback(async () => {
		if (!token) {
			toast.error("Your login has expired.");
			return null;
		}
		try {
			const res = await axios.post(
				"/api/chat/sessions",
				{ title: DEFAULT_SESSION_TITLE },
				{ headers: { Authorization: `Bearer ${token}` } }
			);
			const newSession = res.data;
			setSessions((prev) => [newSession, ...prev]);
			return newSession;
		} catch (error) {
			console.error("Cannot create session", error);
			toast.error("Unable to start a new conversation.");
			return null;
		}
	}, [token]);

	const handleCreateSession = useCallback(() => {
		setActiveSessionId(null);
		setMessages([]);
		setInput("");
		setStatusText("");
	}, []);

	const renameSession = useCallback(
		async (sessionId, title) => {
			if (!token) {
				toast.error("Your login has expired.");
				return false;
			}
			const trimmed = (title || "").trim();
			if (!trimmed) {
				return false;
			}
			try {
				await axios.put(
					`/api/chat/sessions/${sessionId}`,
					{ title: trimmed },
					{ headers: { Authorization: `Bearer ${token}` } }
				);
				setSessions((prev) =>
					prev.map((session) =>
						session.id === sessionId ? { ...session, title: trimmed } : session
					)
				);
				return true;
			} catch (error) {
				console.error("Cannot rename session", error);
				toast.error("Unable to rename conversation.");
				return false;
			}
		},
		[token]
	);

	const handleSend = async () => {
		const trimmed = input.trim();
		if (!trimmed || sending) {
			return;
		}
		if (!token) {
			toast.error("Your login has expired.");
			return;
		}

		let sessionId = activeSessionId;
		let createdDuringSend = false;
		let newlyCreatedSession = null;
		if (!sessionId) {
			const created = await createSession();
			if (!created) return;
			sessionId = created.id;
			createdDuringSend = true;
			newlyCreatedSession = created;
			setActiveSessionId(sessionId);
		}

		const tempId = `temp-${Date.now()}`;
		const optimisticMessage = {
			id: tempId,
			role: "user",
			content: trimmed,
			created_at: new Date().toISOString(),
		};

		setMessages((prev) => [...prev, optimisticMessage]);
		setInput("");
		setSending(true);
		setStatusText("Sending to the assistant...");

		try {
			await axios.post(
				`/api/chat/sessions/${sessionId}/messages`,
				{ message: trimmed, display_name: displayName.trim() },
				{ headers: { Authorization: `Bearer ${token}` } }
			);
			await fetchMessages(sessionId);
			await fetchSessions();
			const shouldAutoRename = (() => {
				const session = newlyCreatedSession || sessions.find((item) => item.id === sessionId);
				if (!session) return true;
				const normalized = (session.title || "").trim().toLowerCase();
				return !normalized || LEGACY_DEFAULT_TITLES.includes(normalized);
			})();
			if (shouldAutoRename) {
				const suggestion = trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
				await renameSession(sessionId, suggestion);
			}
		} catch (error) {
			console.error("Cannot send message", error);
			setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
			if (createdDuringSend) {
				try {
					await axios.delete(`/api/chat/sessions/${sessionId}`, {
						headers: { Authorization: `Bearer ${token}` },
					});
					setSessions((prev) => prev.filter((session) => session.id !== sessionId));
					await fetchSessions();
				} catch (cleanupError) {
					console.error("Cannot remove empty session", cleanupError);
				}
			}
			toast.error(error.response?.data?.message || "Failed to send message.");
		} finally {
			setSending(false);
			setStatusText("");
		}
	};

	const handleKeyDown = (event) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			handleSend();
		}
	};

	const handleSelectSession = (sessionId) => {
		if (sessionId === activeSessionId) return;
		setActiveSessionId(sessionId);
	};

	const handleDeleteSession = async (event, sessionId) => {
		event.stopPropagation();
		if (!token) {
			toast.error("Your login has expired.");
			return;
		}
		const confirmDelete = window.confirm("Delete this conversation?");
		if (!confirmDelete) return;
		try {
			await axios.delete(`/api/chat/sessions/${sessionId}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (sessionId === activeSessionId) {
				setActiveSessionId(null);
				setMessages([]);
			}
			await fetchSessions();
		} catch (error) {
			console.error("Cannot delete session", error);
			toast.error("Unable to delete conversation.");
		}
	};

	const handleRenameSession = async (event, session) => {
		event.stopPropagation();
		const currentTitle = (session.title || DEFAULT_SESSION_TITLE).trim() || DEFAULT_SESSION_TITLE;
		const proposed = window.prompt("Name this conversation", currentTitle);
		if (proposed === null) return;
		const trimmed = proposed.trim();
		if (!trimmed || trimmed === currentTitle) return;
		await renameSession(session.id, trimmed);
	};

	const renderMessage = (message) => {
		const isUser = message.role === "user";
		return (
			<div key={message.id} className={`message-row ${isUser ? "user" : "bot"}`}>
				{!isUser && (
					<div className="avatar bot-avatar">
						<FaRobot />
					</div>
				)}
				<div className="bubble">
					<span className="label">{isUser ? displayName : "Travel Support AI"}</span>
					<p>{message.content}</p>
				</div>
				{isUser && (
					<div className="avatar user-avatar">
						<FaUserCircle />
					</div>
				)}
			</div>
		);
	};

	const activeSession = useMemo(
		() => sessions.find((session) => session.id === activeSessionId) || null,
		[sessions, activeSessionId]
	);

	return (
		<div className="chat-page-container">
			<div className="chatbot-theme">
				<div className="app-shell">
					<header className="app-header">
						<div className="brand-pill">
							<h2>Travel Support AI</h2>
						</div>
						<div className="session-heading">
							<h1>{activeSession?.title || "AI Trip Concierge"}</h1>
							<p>Ask anything and get travel plans that match your style.</p>
						</div>
						<div className="name-field">
							<input
								id="display-name"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								placeholder="Your name"
							/>
						</div>
					</header>

					<div className="chat-layout">
						<aside className="chat-sidebar">
							<div className="sidebar-header">
								<h3>Chat history</h3>
								<button className="new-chat-btn" onClick={handleCreateSession}>
									<FaPlus /> New chat
								</button>
							</div>
							<div className="session-list">
								{sessionsLoading && <p className="session-placeholder">Loading…</p>}
								{!sessionsLoading && sessions.length === 0 && (
									<p className="session-placeholder">No conversations yet.</p>
								)}
								{sessions.map((session) => {
									const normalizedTitle = (() => {
										const raw = (session.title || "").trim();
										const normalized = raw.toLowerCase();
										if (!raw || LEGACY_DEFAULT_TITLES.includes(normalized)) {
											return DEFAULT_SESSION_TITLE;
										}
										return raw;
									})();
									const snippet = session.last_message || "No messages yet";
									return (
										<div
											key={session.id}
											className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
											onClick={() => handleSelectSession(session.id)}
										>
											<div className="session-text">
												<p className="session-title">{normalizedTitle}</p>
												<p className="session-snippet">{snippet}</p>
											</div>
										<div className="session-meta">
											<span>{formatSessionTimestamp(session.updated_at)}</span>
											<div className="session-actions">
												<button
													onClick={(event) => handleRenameSession(event, session)}
													className="session-rename"
													aria-label="Rename conversation"
												>
													<FaEdit />
												</button>
												<button
													onClick={(event) => handleDeleteSession(event, session.id)}
													className="session-delete"
													aria-label="Delete conversation"
												>
													<FaTrash />
												</button>
											</div>
										</div>
										</div>
									);
								})}
							</div>
						</aside>

						<div className="chat-main">
							<div className="chat-window">
								<div className="chat-stream">
									{messagesLoading && <div className="status-row">Loading conversation…</div>}
									{messages.map(renderMessage)}
									{statusText && <div className="status-row">{statusText}</div>}
									<div ref={messagesEndRef} />
								</div>

								<div className="composer">
									<textarea
										placeholder="Ask your travel question..."
										value={input}
										onChange={(e) => setInput(e.target.value)}
										onKeyDown={handleKeyDown}
										rows={3}
									/>
									<button
										className="send-button"
										onClick={handleSend}
										disabled={sending || !input.trim()}
										aria-label="Send message"
									>
										<FaTelegramPlane color="#fff" />
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function formatSessionTimestamp(value) {
	if (!value) return "";
	try {
		const date = new Date(value);
		return date.toLocaleString([], {
			hour: "2-digit",
			minute: "2-digit",
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});
	} catch (error) {
		return "";
	}
}
