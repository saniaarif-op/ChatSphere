import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  CircleUserRound,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  Settings,
  Smile,
  Sparkles,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
  LogOut
} from 'lucide-react';
import { api } from './api';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

function initials(name = '') {
  return (
    name
      .split(' ')
      .map(x => x[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function timeLabel(date) {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function roomId(a, b) {
  return [a, b].sort().join(':');
}

const demoPeople = [
  {
    id: 'demo-1',
    name: 'Ahmed Khan',
    email: 'ahmed@example.com'
  },
  {
    id: 'demo-2',
    name: 'Sara Ali',
    email: 'sara@example.com'
  },
  {
    id: 'demo-3',
    name: 'Hamza Raza',
    email: 'hamza@example.com'
  }
];

export default function App() {
  const [token, setToken] = useState(
    localStorage.getItem('cs_token')
  );

  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem('cs_user') || 'null')
  );

  const [authMode, setAuthMode] = useState('login');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(new Set());
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('');
  const [mobileSidebar, setMobileSidebar] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [page, setPage] = useState('chat');
const [authLoading, setAuthLoading] = useState(false);
const [notifications, setNotifications] = useState([]);

  const socketRef = useRef(null);
  const typingTimer = useRef(null);
  const bottomRef = useRef(null);

  /*
   * LOAD USERS + SOCKET CONNECTION
   */
  useEffect(() => {
    if (!token || !user) {
      return;
    }

    let active = true;

    const loadUsers = async () => {
      try {
        const data = await api.users(token);

        if (active) {
          setUsers(data);
        }
      } catch (e) {
        if (active) {
          setNotice(e.message);
        }
      }
    };

    loadUsers();

    const socket = io(SOCKET_URL, {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (active) {
        setConnected(true);
      }
    });

    socket.on('disconnect', () => {
      if (active) {
        setConnected(false);
      }
    });

    socket.on('connect_error', e => {
      if (active) {
        setNotice(e.message);
      }
    });

    socket.on(
      'presence:update',
      ({ userId, online: isOnline }) => {
        if (!active) {
          return;
        }

        setOnline(prev => {
          const next = new Set(prev);

          if (isOnline) {
            next.add(userId);
          } else {
            next.delete(userId);
          }

          return next;
        });
      }
    );

    socket.on('message:new', message => {
      if (!active) {
        return;
      }

      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }

        if (
          selected &&
          (
            message.senderId === selected.id ||
            message.receiverId === selected.id
          )
        ) {
          return [...prev, message];
        }

        return prev;
      });
    });

    socket.on(
      'typing:update',
      ({ userId, typing: isTyping }) => {
        if (
          active &&
          selected?.id === userId
        ) {
          setTyping(isTyping);
        }
      }
    );

    return () => {
      active = false;

      socket.removeAllListeners();
      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [token, user]);

    /*
   * LOAD REAL NOTIFICATIONS
   */
  useEffect(() => {
  if (!token) {
    return;
  }

  let active = true;

  const loadNotifications = async () => {
    try {
      const data = await api.notifications(token);

      if (active) {
        setNotifications(
          Array.isArray(data) ? data : []
        );
      }
    } catch (e) {
      if (active) {
        setNotice(e.message);
      }
    }
  };

    loadNotifications();

    return () => {
      active = false;
    };
  }, [page, token]);

  /*
   * LOAD MESSAGES WHEN A CONTACT IS SELECTED
   */
  useEffect(() => {
    if (!selected || !token || !user) {
      return;
    }

    let active = true;

    const loadMessages = async () => {
      try {
        const data = await api.messages(
          token,
          selected.id
        );

        if (active) {
          setMessages(data);
        }
      } catch (e) {
        if (active) {
          setNotice(e.message);
        }
      }
    };

    loadMessages();

    socketRef.current?.emit('room:join', {
      roomId: roomId(user.id, selected.id)
    });

    setMobileSidebar(false);

    return () => {
      active = false;
    };
  }, [selected, token, user]);

  /*
   * SCROLL TO LATEST MESSAGE
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages, typing]);

  /*
   * SEARCH USERS
   */
  const visibleUsers = useMemo(() => {
    const source = users.length
      ? users
      : demoPeople;

    return source.filter(userItem =>
      userItem.name
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [users, search]);

  /*
   * LOGIN / REGISTER
   */
  async function handleAuth(e) {
    e.preventDefault();

    setAuthLoading(true);
    setNotice('');

    const form = new FormData(e.currentTarget);

    try {
      const body = {
        name: form.get('name'),
        email: form.get('email'),
        password: form.get('password')
      };

      const data =
        authMode === 'login'
          ? await api.login(body)
          : await api.register(body);

      localStorage.setItem(
        'cs_token',
        data.token
      );

      localStorage.setItem(
        'cs_user',
        JSON.stringify(data.user)
      );

      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  /*
   * SEND MESSAGE
   */
  function sendMessage(e) {
  e.preventDefault();

  if (
    !text.trim() ||
    !selected ||
    !socketRef.current
  ) {
    return;
  }

  const messageContent = text.trim();

  const optimisticMessage = {
    id: `temp-${Date.now()}`,
    senderId: user.id,
    receiverId: selected.id,
    content: messageContent,
    createdAt: new Date().toISOString()
  };

  setMessages(prev => [
    ...prev,
    optimisticMessage
  ]);

  socketRef.current.emit(
    'message:send',
    {
      receiverId: selected.id,
      content: messageContent
    }
  );

  socketRef.current.emit(
    'typing:stop',
    {
      receiverId: selected.id
    }
  );

  setText('');
}

  /*
   * TYPING
   */
  function onTyping(e) {
    setText(e.target.value);

    if (
      !selected ||
      !socketRef.current
    ) {
      return;
    }

    socketRef.current.emit(
      'typing:start',
      {
        receiverId: selected.id
      }
    );

    clearTimeout(typingTimer.current);

    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit(
        'typing:stop',
        {
          receiverId: selected.id
        }
      );
    }, 900);
  }

  /*
   * LOGOUT
   */
  function logout() {
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_user');

    clearTimeout(typingTimer.current);

    socketRef.current?.disconnect();

    setToken(null);
    setUser(null);
    setSelected(null);
    setMessages([]);
    setUsers([]);
    setConnected(false);
    setProfileOpen(false);
  }

  /*
   * AUTH SCREEN
   */
  if (!token || !user) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        onSubmit={handleAuth}
        loading={authLoading}
        notice={notice}
      />
    );
  }

  /*
   * MAIN APPLICATION
   */
  return (
    <div className="app-shell">

      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      {/* TOP BAR */}
      <header className="topbar">

        <div className="brand">
          <div className="brand-mark">
            <MessageCircle size={21} />
          </div>

          <div>
            <strong>ChatSphere</strong>
            <span>Real-time workspace</span>
          </div>
        </div>

        <div className="top-actions">

          <div
            className={`connection ${
              connected ? 'online' : 'offline'
            }`}
          >
            <span />
            {connected
              ? 'Connected'
              : 'Reconnecting'}
          </div>

        <button
  className="icon-btn"
  onClick={() =>
    setPage('notifications')
  }
>
  <Bell size={19} />

  {notifications.filter(n => !n.read).length > 0 && (
    <i>{notifications.filter(n => !n.read).length}</i>
  )}
</button>

          <button
            className="profile-chip"
            onClick={() =>
              setProfileOpen(v => !v)
            }
          >
            <div className="avatar small">
              {initials(user.name)}
            </div>

            <span>
              {user.name.split(' ')[0]}
            </span>
          </button>

          {profileOpen && (
            <div className="profile-menu">

              <button
                onClick={() => {
                  setPage('profile');
                  setProfileOpen(false);
                }}
              >
                <CircleUserRound size={17} />
                Profile
              </button>

              <button
                onClick={() => {
                  setPage('profile');
                  setProfileOpen(false);
                }}
              >
                <Settings size={17} />
                Settings
              </button>

              <button
                className="danger"
                onClick={logout}
              >
                <LogOut size={17} />
                Logout
              </button>

            </div>
          )}

        </div>
      </header>

      {/* WORKSPACE */}
      <main className="workspace">

        {/* SIDEBAR */}
        <aside
          className={`sidebar ${
            mobileSidebar ? 'show' : ''
          }`}
        >

          <div className="sidebar-title">

  <div className="sidebar-heading">

    {page !== 'chat' && (
      <button
        className="sidebar-back"
        onClick={() => setPage('chat')}
        title="Back to Messages"
      >
        <ChevronLeft size={20} />
      </button>
    )}

    <div>
      <h2>
        {page === 'chat'
          ? 'Messages'
          : page === 'contacts'
          ? 'Contacts'
          : page === 'notifications'
          ? 'Notifications'
          : 'Profile'}
      </h2>

      <span>
        {users.length || 0}
        {' '}
        people in workspace
      </span>
    </div>

  </div>

  {page === 'chat' && (
    <button className="round-btn">
      <UserPlus size={18} />
    </button>
  )}

</div>

          {/* CHAT PAGE */}
          {page === 'chat' && (
            <>
              <div className="search-box">
                <Search size={17} />

                <input
                  placeholder="Search conversations..."
                  value={search}
                  onChange={e =>
                    setSearch(e.target.value)
                  }
                />
              </div>

              <div className="nav-tabs">

                <button className="active">
                  <MessageCircle size={16} />
                  Chats
                </button>

                <button
                  onClick={() =>
                    setPage('contacts')
                  }
                >
                  <Users size={16} />
                  People
                </button>

              </div>

              <div className="people-list">

                {visibleUsers.map(
                  (person, i) => (
                    <button
                      key={person.id}
                      className={`person ${
                        selected?.id === person.id
                          ? 'selected'
                          : ''
                      }`}
                      onClick={() =>
                        setSelected(person)
                      }
                    >

                      <div className="avatar">

                        {initials(person.name)}

                        <span
                          className={
                            online.has(person.id)
                              ? 'presence on'
                              : 'presence'
                          }
                        />

                      </div>

                      <div className="person-copy">

                        <strong>
                          {person.name}
                        </strong>

                        <span>
                          {online.has(person.id)
                            ? 'Online now'
                            : 'Offline'}
                        </span>

                      </div>

                      <span className="time">
                        {i === 0
                          ? 'Now'
                          : '12:4' + i}
                      </span>

                    </button>
                  )
                )}

                {!visibleUsers.length && (
                  <div className="empty-mini">
                    No contacts found.
                  </div>
                )}

              </div>
            </>
          )}

          {/* CONTACTS PAGE */}
          {page === 'contacts' && (
            <div className="people-list">

              {visibleUsers.map(person => (
                <button
                  key={person.id}
                  className="person"
                  onClick={() => {
                    setSelected(person);
                    setPage('chat');
                  }}
                >

                  <div className="avatar">

                    {initials(person.name)}

                    <span
                      className={
                        online.has(person.id)
                          ? 'presence on'
                          : 'presence'
                      }
                    />

                  </div>

                  <div className="person-copy">

                    <strong>
                      {person.name}
                    </strong>

                    <span>
                      {online.has(person.id)
                        ? 'Online'
                        : 'Offline'}
                    </span>

                  </div>

                </button>
              ))}

            </div>
          )}

        {/* NOTIFICATIONS */}
{page === 'notifications' && (
  <div className="notifications">

    {notifications.length === 0 ? (
      <div className="empty-mini">
        <Bell size={22} />
        <p>No notifications yet.</p>
      </div>
    ) : (
      notifications.map(notification => (
        <div
          className="notice-item"
          key={notification.id}
        >
          <div className="notice-dot">
            <Bell size={14} />
          </div>

          <div>
            <strong>
              {notification.title}
            </strong>

            <p>
              {notification.message}
            </p>

            <small>
              {new Date(
                notification.createdAt
              ).toLocaleString()}
            </small>
          </div>
        </div>
      ))
    )}

  </div>
)}
          {/* PROFILE */}
          {page === 'profile' && (
            <div className="profile-side">

              <div className="avatar giant">
                {initials(user.name)}
              </div>

              <h3>{user.name}</h3>

              <p>{user.email}</p>

              <div className="profile-stat">
                <span>Account</span>
                <strong>Active</strong>
              </div>

              <button
                className="wide secondary"
                onClick={logout}
              >
                <LogOut size={17} />
                Sign out
              </button>

            </div>
          )}

        </aside>

        {/* CHAT PANEL */}
        <section className="chat-panel">

          {!selected ? (
            <EmptyState
              onChoose={() =>
                setPage('contacts')
              }
            />
          ) : (
            <>

              {/* CHAT HEADER */}
              <div className="chat-head">

                <button
                  className="back-mobile"
                  onClick={() =>
                    setMobileSidebar(true)
                  }
                >
                  <ChevronLeft />
                </button>

                <div className="avatar">

                  {initials(selected.name)}

                  <span
                    className={
                      online.has(selected.id)
                        ? 'presence on'
                        : 'presence'
                    }
                  />

                </div>

                <div className="chat-person">

                  <strong>
                    {selected.name}
                  </strong>

                  <span>
                    {typing ? (
                      <em>typing...</em>
                    ) : online.has(selected.id) ? (
                      '● Active now'
                    ) : (
                      '○ Offline'
                    )}
                  </span>

                </div>

                <div className="chat-tools">

                  <button className="icon-btn">
                    <Search size={18} />
                  </button>

                  <button className="icon-btn">
                    <MoreHorizontal size={19} />
                  </button>

                </div>

              </div>

              {/* MESSAGES */}
              <div className="message-area">

                <div className="day-pill">
                  TODAY
                </div>

                {messages.length === 0 && (
                  <div className="starter">

                    <div className="starter-icon">
                      <Sparkles />
                    </div>

                    <h3>
                      Start a conversation
                    </h3>

                    <p>
                      Send a message to{' '}
                      {selected.name.split(' ')[0]}
                      {' '}
                      and watch it arrive instantly.
                    </p>

                  </div>
                )}

                {messages.map(m => (
                  <div
                    key={m.id}
                    className={`message-row ${
                      m.senderId === user.id
                        ? 'mine'
                        : ''
                    }`}
                  >

                    <div className="bubble">

                      {m.senderId !== user.id && (
                        <small>
                          {m.sender?.name}
                        </small>
                      )}

                      <p>
                        {m.content}
                      </p>

                      <div className="meta">

                        {timeLabel(
                          m.createdAt
                        )}

                        {m.senderId ===
                          user.id && (
                          <CheckCheck
                            size={14}
                          />
                        )}

                      </div>

                    </div>

                  </div>
                ))}

                {typing && (
                  <div className="typing">

                    <span />
                    <span />
                    <span />

                    {selected.name.split(
                      ' '
                    )[0]}{' '}
                    is typing

                  </div>
                )}

                <div ref={bottomRef} />

              </div>

              {/* MESSAGE COMPOSER */}
              <form
                className="composer"
                onSubmit={sendMessage}
              >

                <button
                  type="button"
                  className="icon-btn"
                >
                  <Paperclip size={19} />
                </button>

                <input
                  value={text}
                  onChange={onTyping}
                  placeholder={`Message ${
                    selected.name.split(' ')[0]
                  }...`}
                />

                <button
                  type="button"
                  className="icon-btn emoji"
                >
                  <Smile size={19} />
                </button>

                <button
                  className="send-btn"
                  type="submit"
                >
                  <Send size={18} />
                </button>

              </form>

            </>
          )}

        </section>

      </main>

      {/* ERROR / NOTICE */}
      {notice && (
        <div className="toast">

          <WifiOff size={16} />

          {notice}

          <button
            onClick={() =>
              setNotice('')
            }
          >
            <X size={15} />
          </button>

        </div>
      )}

    </div>
  );
}

/*
 * NOTIFICATION COMPONENT
 */
function Notice({ title, text }) {
  return (
    <div className="notice-item">

      <div className="notice-dot">
        <Bell size={14} />
      </div>

      <div>

        <strong>{title}</strong>

        <p>{text}</p>

        <small>Just now</small>

      </div>

    </div>
  );
}

/*
 * EMPTY CHAT COMPONENT
 */
function EmptyState({ onChoose }) {
  return (
    <div className="empty-state">

      <div className="empty-orb">
        <MessageCircle size={36} />
      </div>

      <span className="eyebrow">
        WELCOME TO CHATSPHERE
      </span>

      <h1>
        Conversations that
        <br />
        <span>move in real time.</span>
      </h1>

      <p>
        Select a contact to start chatting.
        Messages, presence and typing status
        update instantly.
      </p>

      <button
        className="primary wide"
        onClick={onChoose}
      >
        Explore people
        <ArrowUpRight size={18} />
      </button>

      <div className="feature-row">

        <span>
          <Wifi size={15} />
          Live messaging
        </span>

        <span>
          <Check size={15} />
          Persistent history
        </span>

      </div>

    </div>
  );
}

/*
 * LOGIN / REGISTER SCREEN
 */
function AuthScreen({
  mode,
  setMode,
  onSubmit,
  loading,
  notice
}) {
  const login = mode === 'login';

  return (
    <div className="auth-page">

      <div className="auth-decoration one" />
      <div className="auth-decoration two" />

      <div className="auth-brand">

        <div className="brand-mark">
          <MessageCircle size={21} />
        </div>

        <strong>ChatSphere</strong>

      </div>

      <div className="auth-grid">

        <div className="auth-copy">

          <span className="eyebrow">
            <Sparkles size={14} />
            ENCODERX • WEEK 04
          </span>

          <h1>
            Chat without
            <br />
            <span>waiting.</span>
          </h1>

          <p>
            A polished real-time messaging
            experience powered by WebSockets,
            secure authentication and persistent
            conversations.
          </p>

          <div className="auth-features">

            <span>
              ⚡ Instant messages
            </span>

            <span>
              ● Live presence
            </span>

            <span>
              ✦ Typing indicators
            </span>

          </div>

        </div>

        <form
          className="auth-card"
          onSubmit={onSubmit}
        >

          <div className="auth-card-head">

            <span className="mini-logo">
              <MessageCircle size={18} />
            </span>

            <div>

              <h2>
                {login
                  ? 'Welcome back'
                  : 'Create account'}
              </h2>

              <p>
                {login
                  ? 'Sign in to your workspace'
                  : 'Join your real-time workspace'}
              </p>

            </div>

          </div>

          {!login && (
            <label>
              Full name

              <input
                name="name"
                required
                placeholder="Sania Arif"
              />
            </label>
          )}

          <label>
            Email address

            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password

            <input
              name="password"
              type="password"
              minLength="6"
              required
              placeholder="••••••••"
            />
          </label>

          {notice && (
            <div className="form-error">
              {notice}
            </div>
          )}

          <button
            className="primary auth-submit"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : login
              ? 'Sign in'
              : 'Create account'}

            <ArrowUpRight size={18} />
          </button>

          <p className="switch">

            {login
              ? "Don't have an account?"
              : 'Already have an account?'}

            {' '}

            <button
              type="button"
              onClick={() =>
                setMode(
                  login
                    ? 'register'
                    : 'login'
                )
              }
            >
              {login
                ? 'Create one'
                : 'Sign in'}
            </button>

          </p>

        </form>

      </div>

    </div>
  );
}