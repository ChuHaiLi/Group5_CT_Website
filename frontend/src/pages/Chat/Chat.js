import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import './Chat.css'

export default function Chat() {
	const [messages, setMessages] = useState([
		{ id: 1, sender: 'bot', text: 'Xin chào! Tôi có thể giúp gì cho bạn hôm nay?' },
	])
	const [text, setText] = useState('')
	const [isSending, setIsSending] = useState(false)
	const listRef = useRef(null)

	useEffect(() => {
		if (listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight
		}
	}, [messages, isSending])

	async function handleSend(e) {
		e.preventDefault()
		const trimmed = text.trim()
		if (!trimmed) return

		const myMsg = { id: Date.now(), sender: 'me', text: trimmed }
		setMessages((s) => [...s, myMsg])
		setText('')
		setIsSending(true)

		try {
			const res = await axios.post('http://127.0.0.1:5000/api/chat', { message: trimmed })
			const reply = res.data?.reply || 'Xin lỗi, máy chủ không trả lời.'
			const botMsg = { id: Date.now() + 1, sender: 'bot', text: reply }
			setMessages((s) => [...s, botMsg])
		} catch (err) {
			console.error('Chat API error', err?.response?.data || err.message)
			const botMsg = { id: Date.now() + 1, sender: 'bot', text: 'Có lỗi khi liên lạc đến dịch vụ AI.' }
			setMessages((s) => [...s, botMsg])
		} finally {
			setIsSending(false)
		}
	}

	return (
		<div className="chat-page">
			<div className="chat-header">Hộp Chat</div>

			<div className="chat-list" ref={listRef} aria-live="polite">
				{messages.map((m) => (
					<div key={m.id} className={`chat-message ${m.sender === 'me' ? 'me' : 'bot'}`}>
						<div className="bubble">{m.text}</div>
					</div>
				))}

				{isSending && (
					<div className="chat-message bot">
						<div className="bubble">Đang trả lời...</div>
					</div>
				)}
			</div>

			<form className="chat-input" onSubmit={handleSend}>
				<input
					type="text"
					placeholder="Nhập tin nhắn..."
					value={text}
					onChange={(e) => setText(e.target.value)}
					aria-label="Nhập tin nhắn"
					disabled={isSending}
				/>
				<button type="submit" disabled={isSending || !text.trim()}>{isSending ? '...' : 'Gửi'}</button>
			</form>
		</div>
	)
}

