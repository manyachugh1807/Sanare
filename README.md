# 🌿 Sanare - Private Mental Health Support Platform

<p align="center">
  <img src="https://via.placeholder.com/800x400/7A9E8E/FFFFFF?text=Sanare+Wellness+Platform" alt="Sanare Banner" width="800"/>
</p>

<p align="center">
  <strong>A private, anonymous mental health support platform with AI companionship and blockchain-verified sessions</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-7A9E8E" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-7A9E8E" alt="License"/>
  <img src="https://img.shields.io/badge/blockchain-Algorand-000000" alt="Algorand"/>
  <img src="https://img.shields.io/badge/AI-DeepSeek-7A9E8E" alt="AI"/>
  <img src="https://img.shields.io/badge/real--time-Socket.io-7A9E8E" alt="Socket.io"/>
</p>

---

## 📋 Table of Contents
- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [AI Integration (DeepSeek)](#-ai-integration-deepseek)
- [Blockchain Integration (Algorand)](#-blockchain-integration-algorand)
- [Privacy & Security](#-privacy--security)
- [Installation](#-installation)
- [Usage Guide](#-usage-guide)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

**Sanare** (Latin for "to heal" or "to cure") is a revolutionary mental health support platform that combines **AI-powered emotional support** with **human therapy sessions**, all while ensuring complete anonymity through blockchain-verified session records.

The platform creates a safe space where users can:
- 💬 Talk to an AI companion (Robo) 24/7
- 👥 Connect anonymously with human therapists
- 🌱 Track emotional wellness through a beautiful "flower" visualization
- 🔗 Have sessions immutably recorded on Algorand blockchain (without storing content)

---

## ✨ Features

### 🎯 **Core Features**

| Feature | Description |
|---------|-------------|
| **Anonymous Access** | No registration, no email, no personal data |
| **AI Companion (Robo)** | 24/7 emotional support using DeepSeek AI |
| **Human Therapy** | Connect with real therapists anonymously |
| **Wellness Flower** | Visual representation of emotional state that blooms as you heal |
| **Mood Tracking** | Check-in with your feelings and track patterns |
| **Session Queue** | Fair waiting system for therapist availability |
| **Real-time Chat** | Instant messaging with therapists and AI |
| **Blockchain Anchoring** | Immutable proof of sessions on Algorand |

### 🤖 **AI Features**
- CBT-based therapeutic conversations
- Real-time sentiment analysis
- Emotional tone tracking (0-100 scale)
- Crisis detection with resource sharing
- 24/7 availability with zero wait time
- Conversation history for context
- Streaming responses for natural feel

### 🔗 **Blockchain Features**
- Immutable session proof on Algorand testnet
- Zero-knowledge proof (only hash stored)
- Verifiable timestamps for all sessions
- Public transparency without compromising privacy
- Low-cost transactions (~0.001 ALGO per session)
- Automatic anchoring on session end

### 🌸 **Wellness Flower**
The flower visualization responds to emotional state:
- **0-20**: Wilting, 2 petals - Crisis mode
- **21-35**: Heavy, 3-4 petals - Deep sadness
- **36-50**: Struggling, 5-6 petals - Anxious
- **51-65**: Neutral, 6 petals - Processing
- **66-80**: Calm, 7 petals - Grounded
- **81-100**: Thriving, 8 petals - Full bloom

---

## 🛠 Tech Stack

<p align="center">
  <img src="https://via.placeholder.com/800x200/F5F0E8/2C3830?text=Node.js+Express+Socket.io+Algorand+DeepSeek+OpenRouter" alt="Tech Stack"/>
</p>

### **Backend**
| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment (v18+) |
| **Express.js** | Web framework & API routes |
| **Socket.io** | Real-time bidirectional communication |
| **Algorand SDK** | Blockchain transaction creation & signing |
| **OpenRouter API** | Gateway to DeepSeek AI models |
| **dotenv** | Environment variable management |

### **Frontend**
| Technology | Purpose |
|------------|---------|
| **HTML5/CSS3** | Structure and styling |
| **Vanilla JavaScript** | Client-side logic (no frameworks) |
| **Socket.io Client** | Real-time events from server |
| **SVG Animations** | Interactive flower visualization |
| **Custom CSS** | Responsive, nature-inspired design |

### **Blockchain**
| Component | Details |
|-----------|---------|
| **Network** | Algorand Testnet |
| **Node** | https://testnet-api.algonode.cloud |
| **Transaction Type** | Payment (0 ALGO) with note field |
| **Consensus** | Pure Proof-of-Stake |
| **Finality** | ~4 seconds |
| **Cost** | ~0.001 ALGO per session |

### **AI Models**
| Model | Provider | Use Case |
|-------|----------|----------|
| **DeepSeek Chat** | OpenRouter | Primary conversation AI |
| **DeepSeek Chat** | OpenRouter | Sentiment analysis |

---

## 🏗 Architecture

### **System Architecture Diagram**

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│   Patient       │────▶│   Sanare Server  │────▶│   Therapist     │
│   (Browser)     │     │   (Node.js)      │     │   (Browser)     │
│                 │◀────│                  │◀────│                 │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   DeepSeek AI   │     │   Algorand       │     │   Local Storage │
│   (OpenRouter)  │     │   Blockchain     │     │   (Browser)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### **Data Flow Diagram**

```
Patient Message
       │
       ▼
┌──────────────┐
│  Socket.io   │
│   (Event)    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Server     │
│  Processing  │
└──────┬───────┘
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  To Human    │  │  To AI       │
│  Therapist   │  │  (DeepSeek)  │
└──────────────┘  └──────┬───────┘
                         │
                         ▼
                    ┌──────────────┐
                    │  Sentiment   │
                    │  Analysis    │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Flower     │
                    │   Update     │
                    └──────────────┘

Session End
       │
       ▼
┌──────────────┐
│   Create     │
│   Session    │
│   Hash       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Algorand    │
│  Transaction │
└──────────────┘
```

---

## 🤖 AI Integration (DeepSeek)

### **How AI Works**

1. **User sends message** to Robo chat
2. **Server forwards** to OpenRouter API with DeepSeek model
3. **Streaming response** returns token by token
4. **Sentiment analysis** runs on conversation
5. **Flower updates** based on emotional tone

### **AI System Prompt**

```javascript
const systemPrompt = `You are Robo, a compassionate AI mental wellness companion on Sanare.

Your role:
- Be warm, empathetic, and non-judgmental
- Use evidence-based approaches: CBT reframing, grounding techniques
- Keep responses to 2-3 sentences — brief and present
- Respond to emotional content first, then gently invite reflection
- Never diagnose or prescribe medication
- If you detect crisis signals, gently suggest speaking to a human listener

Tone: gentle, grounded, present. Like a wise, calm friend who listens well.`;
```

### **Sentiment Analysis Scoring**

| Score Range | Emotional State | Flower Response |
|-------------|-----------------|-----------------|
| 0-20 | Crisis, suicidal ideation | Wilting (2 petals) |
| 21-35 | Heavy sadness, grief | Drooping (3-4 petals) |
| 36-50 | Anxious, struggling | Small (5 petals) |
| 51-65 | Neutral, processing | Medium (6 petals) |
| 66-80 | Calm, hopeful | Blooming (7 petals) |
| 81-100 | Thriving, joyful | Full bloom (8 petals) |

### **AI API Endpoints**

```javascript
POST /api/robo
- Body: { messages: [{ role: "user", content: "text" }] }
- Response: Streaming text/event-stream

POST /api/tone
- Body: { messages: conversation[] }
- Response: { score: number }
```

---

## 🔗 Blockchain Integration (Algorand)

### **How Blockchain Works**

1. **Session ends** (therapist ends or disconnects)
2. **Create hash** of session data:
   ```javascript
   const raw = `${patientId}:${therapistId}:${timestamp}`;
   const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
   ```
3. **Create 0 ALGO transaction** with hash in note field
4. **Sign with private key** and broadcast to Algorand
5. **Transaction confirmed** in ~4 seconds
6. **Viewable on explorer** forever

### **Transaction Structure**

```json
{
  "from": "YOUR_ALGORAND_ADDRESS",
  "to": "YOUR_ALGORAND_ADDRESS",
  "amount": 0,
  "note": "sanare:a1b2c3d4e5f6...",
  "fee": 1000 (microAlgos),
  "type": "pay"
}
```

### **Blockchain Flow Diagram**

```
Session End
    │
    ▼
┌─────────────────────┐
│ Create SHA-256 Hash │
│ patient:therapist:time │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Build 0 ALGO Tx     │
│ with hash in note   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Sign with private   │
│ key                 │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Broadcast to        │
│ Algorand Testnet    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Wait for 4          │
│ confirmations       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Transaction ID      │
│ returned to UI      │
└─────────────────────┘
```

### **View on AlgoExplorer**

```
https://testnet.algoexplorer.io/tx/TRANSACTION_ID
```

### **What's Stored vs NOT Stored**

| Stored on Blockchain | NOT Stored |
|---------------------|------------|
| ✅ SHA-256 hash of session | ❌ Conversation content |
| ✅ Timestamp | ❌ Patient real name |
| ✅ Your wallet address | ❌ Therapist real name |
| ✅ Transaction fee | ❌ Medical information |
| ✅ Network proof | ❌ Personal details |

---

## 🔒 Privacy & Security

### **Privacy Features**

```
┌─────────────────────────────────────┐
│         PRIVACY LAYER               │
├─────────────────────────────────────┤
│ 1. Alias Generation                  │
│    └── Random word + number         │
│        (e.g., "Willow-3557")        │
│                                       │
│ 2. SHA-256 Hashing                   │
│    └── alias + salt → 16-char ID    │
│        (only hash sent to server)    │
│                                       │
│ 3. No Persistence                     │
│    └── Sessions in memory only       │
│        (gone when tab closes)        │
│                                       │
│ 4. End-to-End Encryption              │
│    └── All messages encrypted        │
│        in transit                     │
└─────────────────────────────────────┘
```

### **Data Flow with Privacy**

```
Patient Browser
    │
    ├── Generate alias: "Willow-3557"
    │
    ├── Hash: SHA-256("Willow-3557_sanare_salt")
    │   └── Result: "7d8df9a2c1b4..." (16 chars)
    │
    ├── Send ONLY hash to server
    │
    ▼
Server (never sees real alias)
    │
    ├── Store hash in memory
    │
    ├── When session ends
    │
    ▼
Blockchain
    └── Store hash + timestamp
        └── Permanently verifiable
```

---

## 📦 Installation

### **Prerequisites**
- Node.js v18 or higher
- npm or yarn
- Algorand account (optional, for blockchain)
- OpenRouter API key

### **Step-by-Step Setup**

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/sanare.git
cd sanare

# 2. Install dependencies
npm install express socket.io algosdk dotenv

# 3. Create .env file
cp .env.example .env

# 4. Edit .env with your keys
nano .env
```

### **Environment Variables**

```env
# Required: OpenRouter API Key (get from https://openrouter.ai)
OPENROUTER_KEY=sk-or-v1-your_key_here

# Optional: Algorand Mnemonic (for blockchain anchoring)
MNEMONIC=your 25 word mnemonic here

# Optional: Admin Algorand Account
ADMIN_MNEMONIC=your admin mnemonic here

# Optional: Alternative DeepSeek key
DEEPSEEKAI=sk-or-v1-your_deepseek_key_here

# Optional: Port (defaults to 3000)
PORT=3000
```

### **Run the Application**

```bash
# Development mode with auto-restart
npm install -g nodemon
nodemon server.js

# Production mode
node server.js
```

### **Access the Platform**

```
Local:    http://localhost:3000
Network:  http://YOUR_IP:3000

Patient:  http://localhost:3000/dashboard
Therapist: http://localhost:3000/therapist
```

---

## 🎮 Usage Guide

### **For Patients**

#### 1. **Access Dashboard**
- Open `http://localhost:3000/dashboard`
- Your anonymous alias is automatically generated (e.g., "Willow-3557")
- The wellness flower shows your current emotional state

#### 2. **Talk to Robo (AI)**
```
1. Click "Talk to Robo"
2. Type your message
3. Robo responds with empathetic, CBT-based support
4. Flower updates based on conversation tone
5. Available 24/7
```

#### 3. **Talk to Human Therapist**
```
1. Click "Start Conversation"
2. Join the queue (shows your position)
3. Wait for therapist to accept
4. Chat anonymously once connected
5. Session ends with therapist or by closing
```

#### 4. **Track Your Mood**
```
1. Click "How are you feeling?" button
2. Select emoji that matches your mood
3. Flower updates immediately
4. Trends tracked over time
```

#### 5. **Watch Your Flower Grow**
- Petals increase as emotional state improves
- Color intensity reflects wellbeing
- Weekly trends shown in bar graph
- Metrics for mood, sleep, anxiety, etc.

### **For Therapists**

#### 1. **Access Therapist Panel**
- Open `http://localhost:3000/therapist`
- Shows online status and queue

#### 2. **Manage Queue**
```
- View waiting patients with wait times
- See patient mood (if shared)
- Click "Accept" to start session
```

#### 3. **Conduct Session**
```
- Chat in real-time with patient
- View AI-generated summaries
- Track emotional flags
- See patient wellness metrics
- Take private notes (local only)
```

#### 4. **End Session**
```
- Click "End Session"
- Session hash recorded on Algorand
- Notes saved locally for reference
- Patient returned to queue if needed
```

---

## 📚 API Documentation

### **REST Endpoints**

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/robo` | POST | Stream AI response | `{ messages: [...] }` | text/event-stream |
| `/api/tone` | POST | Analyze sentiment | `{ messages: [...] }` | `{ score: number }` |
| `/create-token` | POST | Test token creation | - | `{ txId, assetId }` |

### **Socket.io Events**

#### **Patient Events**
```javascript
// Emit
socket.emit('patient_join', { patientId, alias, color })
socket.emit('patient_queue', { patientId, alias, color, mood })
socket.emit('patient_message', { patientId, alias, message })
socket.emit('mood_update', { patientId, score, label })
socket.emit('patient_end_session', { patientId })

// Listen
socket.on('therapist_count', ({ count }) => {})
socket.on('queue_position', ({ position }) => {})
socket.on('session_accepted', () => {})
socket.on('therapist_message', ({ message }) => {})
socket.on('session_ended_by_therapist', () => {})
```

#### **Therapist Events**
```javascript
// Emit
socket.emit('therapist_join')
socket.emit('therapist_accept', { patientId })
socket.emit('therapist_message', { patientId, message })
socket.emit('therapist_end_session', { patientId })

// Listen
socket.on('queue_update', ({ queue }) => {})
socket.on('patient_message', ({ patientId, alias, message }) => {})
socket.on('mood_update', ({ patientId, score }) => {})
socket.on('session_ended_by_patient', ({ patientId }) => {})
socket.on('session_anchored', ({ txId, patientAlias }) => {})
```

---

## 📁 Project Structure

```
sanare/
├── server.js                 # Main server with AI & blockchain
├── .env                      # Environment variables (not in git)
├── .env.example              # Example environment template
├── .gitignore                # Git ignore rules
├── package.json              # Dependencies
├── README.md                 # This file
│
├── public/                   # Frontend files
│   ├── index.html            # Landing page
│   ├── dashboard.html        # Patient dashboard
│   ├── therapist.html        # Therapist panel
│   ├── dashboard.js          # Patient logic
│   ├── therapist.js          # Therapist logic
│   ├── ai-service.js         # AI service module
│   ├── dashboard.css         # Dashboard styles
│   └── therapist.css         # Therapist styles
│
└── Sanare/                   # Static assets (if any)
    └── public/               # Duplicate structure (optional)
```

---

## 📸 Screenshots

### **Patient Dashboard**
```
┌─────────────────────────────────────────────────────┐
│  Sanare                                    Mar 15   │
│  Your Space                                        │
│  Choose how you'd like to be heard today           │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────┐    │
│  │ Talk to Human   │    │   Wellness Garden    │    │
│  │ 2 therapists    │    │                      │    │
│  │ online          │    │       🌸             │    │
│  │ [Start Chat]    │    │   Your Flower        │    │
│  ├─────────────────┤    │      72%             │    │
│  │ Talk to Robo    │    │                      │    │
│  │ Always available│    │ Mood  ███████ 78%    │    │
│  │ [Chat Now]      │    │ Sleep ██████  65%    │    │
│  └─────────────────┘    └─────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### **Therapist Panel**
```
┌─────────────────────────────────────────────────────┐
│  Sanare Therapist                          14:30   │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────────────────┐    │
│  │ Queue       │    │ Active Session: Willow  │    │
│  │ 1. Cedar 2m│    │ [Messages appear here]   │    │
│  │ 2. River 5m│    │                          │    │
│  │ 3. Fern 8m │    │ > Type message... [Send] │    │
│  └─────────────┘    ├─────────────────────────┤    │
│                     │ AI Summary: Anxiety     │    │
│                     │ flagged. Suggest CBT    │    │
│                     └─────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### **AI Chat Interface**
```
┌─────────────────────────────────────────────────────┐
│  Robo                                      🤖      │
├─────────────────────────────────────────────────────┤
│  Robo: Hello! I'm here to listen. How are you      │
│        feeling today?                               │
│        14:30                                        │
│                                                     │
│  You: I've been feeling anxious about work          │
│       14:31                                         │
│                                                     │
│  Robo: I hear that work stress is weighing on you.  │
│        That's completely valid. Would you like to   │
│        try a quick grounding exercise?              │
│        14:31                                     ●  │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Share anything...                      [→]  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### **Wellness Flower Evolution**
```
Stage 1: Wilting          Stage 2: Growing        Stage 3: Blooming
(Score 0-20)              (Score 21-50)           (Score 51-100)

    ╱╲                        ╱╲╱╲                     ╱╲╱╲
   ╱  ╲                      ╱    ╲                   ╱    ╲
  ╱    ╲                    ╱      ╲                 ╱      ╲
  ╲    ╱                    ╲      ╱                 ╲  🌸  ╱
   ╲  ╱                      ╲    ╱                   ╲    ╱
    ╲╱                        ╲╱╲╱                     ╲╱╲╱
     █                         █                         █
  2 petals                  4-5 petals                7-8 petals
```

---

## 🤝 Contributing

### **How to Contribute**

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push to branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### **Development Guidelines**

- Follow existing code style
- Add comments for complex logic
- Test thoroughly before submitting
- Update documentation as needed
- Keep privacy & security in mind

### **Areas for Contribution**

- 🌐 Additional AI models
- 🔗 Other blockchain integrations
- 📊 Enhanced analytics
- 🎨 UI/UX improvements
- 🌍 Multi-language support
- 📱 Mobile app development

---

## 📄 License

This project is licensed under the MIT License - see below:

```
MIT License

Copyright (c) 2024 Sanare

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- **Algorand Foundation** for the blockchain infrastructure
- **OpenRouter** for AI model access
- **DeepSeek** for the powerful language model
- **Mental health professionals** who inspired the design
- **Open source community** for amazing tools

---

## 📞 Support

For issues, questions, or contributions:
- 📧 Email: support@sanare.health
- 🐛 GitHub Issues: [Create an issue](https://github.com/yourusername/sanare/issues)
- 📖 Documentation: [docs.sanare.health](https://docs.sanare.health)

---

<p align="center">
  Made with 🌿 for mental wellness
</p>

<p align="center">
  <strong>Sanare</strong> — because everyone deserves a safe space to heal.
</p>