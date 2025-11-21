# Plucky Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Security Model](#security-model)
5. [Memory System](#memory-system)
6. [API Design](#api-design)

## System Overview

Plucky is built on a **hybrid architecture** that optimizes for both security and performance:
- **Client-side Realtime** - Direct browser-to-OpenAI connection for low-latency audio
- **Server-side Memory** - Backend API layer protects graph database access

### High-Level Architecture

```mermaid
graph LR
    subgraph Browser
        A[React App]
        B[Realtime Session]
        C[Audio Processor]
    end

    subgraph Next.js Server
        D[API Routes]
        E[MCP Client Singleton]
        F[Session Service]
    end

    subgraph Docker Services
        G[Graphiti MCP Server]
        H[Neo4j]
    end

    A --> B
    B <-->|WebSocket Audio| OpenAI[OpenAI Realtime API]
    B -->|Tool Calls| D
    D --> E
    E <-->|JSON-RPC| G
    G <-->|Cypher| H
    A -->|Get Token| F
    F -->|Ephemeral Key| OpenAI

    style Browser fill:#e3f2fd
    style Next.js Server fill:#fff3e0
    style Docker Services fill:#e8f5e9
```

## Component Architecture

### Frontend Components

```mermaid
graph TD
    A[page.tsx - Main Entry] --> B[AppContent]
    B --> C[LoadingAnimation]
    B --> D[Transcript]
    B --> E[Events]
    B --> F[BottomToolbar]

    B --> G[useRealtimeSession Hook]
    B --> H[useAudioDownload Hook]

    G --> I[TranscriptContext]
    G --> J[EventContext]

    K[createChatAgent] --> L[Plucky RealtimeAgent]
    L --> M[Memory Tools]
    L --> N[Persona Instructions]

    style A fill:#bbdefb
    style G fill:#c8e6c9
    style K fill:#f8bbd0
```

### Backend Components

```mermaid
graph TD
    A[API Routes] --> B["api/session"]
    A --> C["api/memory/*"]

    C --> D[add-episode]
    C --> E[search-nodes]
    C --> F[search-facts]
    C --> G[get-episodes]
    C --> H[delete-episode]
    C --> I[delete-entity-edge]
    C --> J[forget]

    K[MCP Client] --> L[Global Singleton]
    L --> M[Session Management]
    L --> N[JSON-RPC Protocol]

    D --> K
    E --> K
    F --> K
    G --> K
    H --> K
    I --> K
    J --> K

    style A fill:#fff9c4
    style K fill:#f8bbd0
```

### Agent Tool Architecture

```mermaid
graph LR
    A[Plucky Agent] --> B{Tool Call}

    B -->|Memory| C[add_episode]
    B -->|Search| D[search_nodes]
    B -->|Search| E[search_facts]
    B -->|History| F[get_episodes]
    B -->|Delete| G[delete_episode]
    B -->|Delete| H[delete_entity_edge]
    B -->|Clear| I[forget_all]
    B -->|Session| J[end_session]

    C -->|POST| K["api/memory/add-episode"]
    D -->|POST| L["api/memory/search-nodes"]
    E -->|POST| M["api/memory/search-facts"]
    F -->|POST| N["api/memory/get-episodes"]
    G -->|POST| O["api/memory/delete-episode"]
    H -->|POST| P["api/memory/delete-entity-edge"]
    I -->|POST| Q["api/memory/forget"]

    K --> R[MCP Client]
    L --> R
    M --> R
    N --> R
    O --> R
    P --> R
    Q --> R

    R --> S[Graphiti]

    style A fill:#e1bee7
    style R fill:#ffccbc
    style S fill:#c5e1a5
```

## Data Flow

### Conversation Initialization Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as React UI
    participant SS as Session Service
    participant OAI as OpenAI
    participant Agent as Plucky Agent
    participant API as API Routes
    participant MCP as MCP Client
    participant Graph as Graphiti

    U->>UI: Click Connect
    UI->>SS: Request ephemeral token
    SS->>OAI: Create realtime session
    OAI-->>SS: Return client_secret
    SS-->>UI: Ephemeral token

    UI->>OAI: Connect WebSocket with token
    OAI-->>UI: Connection established

    UI->>Agent: Initialize Plucky
    Agent->>Agent: Generate session ID

    Note over Agent,Graph: Startup Memory Loading

    Agent->>UI: Call get_episodes tool
    UI->>API: POST /api/memory/get-episodes
    API->>MCP: callTool('get_episodes')
    MCP->>Graph: JSON-RPC: get_episodes
    Graph-->>MCP: Recent episodes
    MCP-->>API: Episodes data
    API-->>UI: Episodes JSON
    UI-->>Agent: Tool result

    Agent->>UI: Call search_nodes tool
    UI->>API: POST /api/memory/search-nodes
    API->>MCP: callTool('search_nodes')
    MCP->>Graph: JSON-RPC: search_nodes
    Graph-->>MCP: User entities
    MCP-->>API: Entities data
    API-->>UI: Entities JSON
    UI-->>Agent: Tool result

    Agent->>Agent: Analyze context
    Agent->>U: Greet user (with context)
```

### Memory Save Flow

```mermaid
sequenceDiagram
    participant U as User
    participant Agent as Plucky
    participant Browser as Browser
    participant API as API Route
    participant MCP as MCP Client
    participant Graphiti as Graphiti
    participant DB as Neo4j

    U->>Agent: "Hi, I'm Bob"
    Agent->>Agent: Identify important info

    Agent->>Browser: add_episode({<br/>name: "User introduction",<br/>description: "User is Bob",<br/>group_id: "user_default",<br/>session_id: "Session_..."<br/>})

    Browser->>API: POST /api/memory/add-episode

    API->>API: Append session context
    API->>MCP: callTool('add_memory', {<br/>episode_body: "User is Bob...<br/>[Context: Session_...]"<br/>})

    MCP->>MCP: Check if connected
    alt Not Connected
        MCP->>Graphiti: Initialize MCP session
        Graphiti-->>MCP: Session ID
    end

    MCP->>Graphiti: JSON-RPC: tools/call<br/>add_memory

    Graphiti->>Graphiti: Extract entities
    Graphiti->>Graphiti: Generate embeddings
    Graphiti->>DB: CREATE (e:Episodic {body: "..."})
    Graphiti->>DB: CREATE (p:Person {name: "Bob"})
    Graphiti->>DB: CREATE (e)-[:MENTIONS]->(p)

    DB-->>Graphiti: Success
    Graphiti-->>MCP: Episode UUID
    MCP-->>API: Result
    API-->>Browser: Success
    Browser-->>Agent: Memory saved

    Agent->>U: "Nice to meet you, Bob!"
```

### Memory Retrieval Flow

```mermaid
sequenceDiagram
    participant U as User
    participant Agent as Plucky
    participant Browser as Browser
    participant API as API Route
    participant MCP as MCP Client
    participant Graphiti as Graphiti
    participant DB as Neo4j

    U->>Agent: "What's my name?"
    Agent->>Agent: Recognize trigger phrase

    Agent->>Browser: search_nodes({<br/>query: "user name personal information",<br/>group_id: "user_default"<br/>})

    Browser->>API: POST /api/memory/search-nodes
    API->>MCP: callTool('search_nodes')

    MCP->>Graphiti: JSON-RPC: search_nodes

    Graphiti->>Graphiti: Generate query embedding
    Graphiti->>DB: Vector similarity search
    Graphiti->>DB: MATCH (n:Person)<br/>WHERE score > threshold

    DB-->>Graphiti: Person nodes (Bob)
    Graphiti-->>MCP: Nodes + metadata
    MCP-->>API: Search results
    API-->>Browser: Results JSON
    Browser-->>Agent: Found: Bob

    Agent->>Agent: Integrate naturally
    Agent->>U: "Your name is Bob"
```

## Security Model

### Authentication & Authorization

```mermaid
graph TD
    A[User Request] --> B{Request Type}

    B -->|Realtime Audio| C[Ephemeral Token]
    B -->|Memory Operation| D[API Route]

    C --> E[OpenAI Validates Token]
    E --> F{Valid?}
    F -->|Yes| G[WebSocket Connection]
    F -->|No| H[401 Unauthorized]

    D --> I[Server-Side Code]
    I --> J[MCP Client]
    J --> K{Has Session?}
    K -->|Yes| L[Reuse Session]
    K -->|No| M[Initialize New Session]

    L --> N[Execute Tool]
    M --> N

    N --> O[Graphiti Validates]
    O --> P[Neo4j Query]

    style C fill:#c8e6c9
    style I fill:#fff9c4
    style J fill:#ffccbc
```

### Security Layers

| **Layer** | **Protection** | **Implementation** |
|-----------|----------------|-------------------|
| **API Key** | Never exposed to client | Stored in `.env.local`, server-only |
| **Ephemeral Tokens** | Short-lived, scoped | Generated per-session |
| **MCP Client** | Server-side only | Runtime check for `window` |
| **API Routes** | Validation & sanitization | Input validation on all endpoints |
| **Graph Access** | No direct client access | MCP layer abstracts Neo4j |
| **Tool Execution** | Validated by OpenAI | JSON schema enforcement |

## Memory System

### Knowledge Graph Schema

```mermaid
erDiagram
    EPISODIC ||--o{ ENTITY : mentions
    EPISODIC ||--o{ FACT : contains
    ENTITY ||--o{ FACT : subject
    ENTITY ||--o{ FACT : object
    SESSION ||--o{ EPISODIC : during

    EPISODIC {
        string uuid PK
        string name
        string body
        string source
        datetime created_at
        string group_id
        vector embedding
    }

    ENTITY {
        string uuid PK
        string name
        string summary
        string[] labels
        datetime created_at
        string group_id
        vector embedding
    }

    FACT {
        string uuid PK
        string name
        string fact
        datetime created_at
        datetime expired_at
        boolean valid
        string group_id
    }

    SESSION {
        string session_id PK
        datetime timestamp
    }
```

### Entity Types & Relationships

```mermaid
graph LR
    subgraph Entity Types
        A[Person]
        B[Preference]
        C[Topic]
        D[Event]
        E[Location]
        F[Organization]
        G[Document]
        H[Requirement]
        I[Procedure]
    end

    subgraph Relationship Types
        J[RELATES_TO]
        K[MENTIONS]
        L[PREFERS]
        M[WORKS_AT]
        N[LOCATED_IN]
        O[REQUIRES]
        P[PARTICIPATES_IN]
    end

    A -->|WORKS_AT| F
    A -->|PREFERS| B
    A -->|LOCATED_IN| E
    C -->|RELATES_TO| C
    D -->|LOCATED_IN| E
    A -->|PARTICIPATES_IN| D
    A -->|REQUIRES| H

    style A fill:#e1bee7
    style B fill:#ffccbc
    style C fill:#c5e1a5
```

### Memory Retrieval Strategy

```mermaid
flowchart TD
    A[Memory Query] --> B{Query Type}

    B -->|"What do you know?"| C[Broad Search]
    B -->|"What's my name?"| D[Targeted Search]
    B -->|"What did we discuss?"| E[Temporal Search]

    C --> F["search_nodes
    query: user info preferences"]
    D --> G["search_nodes
    query: user name"]
    E --> H["get_episodes
    max: 20"]

    F --> I[Vector Similarity]
    G --> I
    H --> J[Sort by created_at DESC]

    I --> K[Filter by group_id]
    J --> K

    K --> L[Return Results]
    L --> M[Agent Integrates Naturally]
    M --> N[Natural Response]

    style C fill:#c8e6c9
    style D fill:#fff9c4
    style E fill:#ffccbc
```

## API Design

### REST Endpoints

| **Endpoint** | **Method** | **Purpose** | **Auth** |
|--------------|------------|-------------|----------|
| `/api/session` | POST | Generate ephemeral token | Server |
| `/api/memory/add-episode` | POST | Save new memory | None* |
| `/api/memory/search-nodes` | POST | Search entities | None* |
| `/api/memory/search-facts` | POST | Search relationships | None* |
| `/api/memory/get-episodes` | POST | Get recent history | None* |
| `/api/memory/delete-episode` | POST | Delete specific memory | None* |
| `/api/memory/delete-entity-edge` | POST | Delete relationship | None* |
| `/api/memory/forget` | POST | Clear all memories | None* |

*Note: In production, add authentication middleware (JWT, session cookies, etc.)

### API Request/Response Examples

**Add Episode:**
```typescript
// Request
POST /api/memory/add-episode
{
  "name": "User introduction",
  "description": "User is Bob, a software engineer",
  "source": "message",
  "source_description": "User chat",
  "group_id": "user_default",
  "session_id": "Session_2025-11-21_abc123"
}

// Response
{
  "content": [
    {
      "type": "text",
      "text": "{\"uuid\": \"ep_123...\", \"created_at\": \"2025-11-21T...\"}"
    }
  ]
}
```

**Search Nodes:**
```typescript
// Request
POST /api/memory/search-nodes
{
  "query": "user name personal information",
  "group_id": "user_default",
  "entity_types": ["Person"]  // Optional
}

// Response
{
  "content": [
    {
      "type": "text",
      "text": "{\"nodes\": [{\"uuid\": \"...\", \"name\": \"Bob\", \"summary\": \"...\"}]}"
    }
  ]
}
```

### MCP Protocol Flow

```mermaid
sequenceDiagram
    participant API as API Route
    participant MCP as MCP Client
    participant Server as Graphiti MCP Server

    Note over API,Server: Initialization (Once per Module Load)

    MCP->>Server: POST /mcp<br/>{"method": "initialize", ...}
    Server-->>MCP: 200 OK<br/>Mcp-Session-Id: abc123
    MCP->>MCP: Store session ID

    MCP->>Server: POST /mcp<br/>{"method": "notifications/initialized"}
    Server-->>MCP: 200 OK

    Note over API,Server: Tool Calls (Reuse Session)

    API->>MCP: callTool('search_nodes', {...})
    MCP->>MCP: Check isConnected

    MCP->>Server: POST /mcp<br/>Mcp-Session-Id: abc123<br/>{"method": "tools/call", ...}
    Server-->>MCP: 200 OK<br/>event: message<br/>data: {"result": {...}}

    MCP->>MCP: Parse SSE response
    MCP-->>API: Return result
```

### Error Handling

```mermaid
graph TD
    A[API Request] --> B{Validation}
    B -->|Invalid| C[400 Bad Request]
    B -->|Valid| D[Call MCP Client]

    D --> E{MCP Connected?}
    E -->|No| F[Initialize Connection]
    E -->|Yes| G[Execute Tool]

    F --> H{Connection Success?}
    H -->|No| I[500 Server Error]
    H -->|Yes| G

    G --> J{Tool Success?}
    J -->|No| K[500 Tool Error]
    J -->|Yes| L[200 OK]

    C --> M[Return Error JSON]
    I --> M
    K --> M
    L --> N[Return Result JSON]

    style C fill:#ffccbc
    style I fill:#ffccbc
    style K fill:#ffccbc
    style L fill:#c8e6c9
```

## Performance Optimizations

### MCP Client Singleton Pattern

```typescript
// Global singleton - persists across hot reloads
const globalForMCP = globalThis as unknown as {
  mcpClient: MCPClient | undefined;
};

export const mcpClient =
  globalForMCP.mcpClient ??
  new MCPClient(process.env.MCP_SERVER_URL);

if (typeof window === 'undefined') {
  globalForMCP.mcpClient = mcpClient;
}
```

**Benefits:**
- ✅ Single persistent MCP session
- ✅ No duplicate connections
- ✅ Survives Next.js hot reloads
- ✅ No EventEmitter warnings

### Lazy Connection

```typescript
async callTool(name: string, args: any): Promise<any> {
  if (!this.isConnected) {
    await this.connect();  // Connect on first use
  }
  // Execute tool...
}
```

**Benefits:**
- ✅ No connection until needed
- ✅ Reuses existing session
- ✅ Fast subsequent calls

## Deployment Considerations

### Production Checklist

- [ ] Add authentication middleware to API routes
- [ ] Set up rate limiting (prevent abuse)
- [ ] Configure CORS properly
- [ ] Use production database (not Docker)
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Enable HTTPS
- [ ] Implement user sessions (multi-user support)
- [ ] Add backup strategy for Neo4j
- [ ] Configure environment variables securely
- [ ] Add analytics & telemetry

### Scaling Strategy

```mermaid
graph LR
    subgraph "Current (Single User)"
        A[Browser] --> B[Next.js]
        B --> C[MCP Client]
        C --> D[Graphiti]
        D --> E[Neo4j]
    end

    subgraph "Production (Multi-User)"
        F[Load Balancer]
        G[Next.js Instance 1]
        H[Next.js Instance 2]
        I[Shared MCP Pool]
        J[Graphiti Cluster]
        K[Neo4j Cluster]

        F --> G
        F --> H
        G --> I
        H --> I
        I --> J
        J --> K
    end

    style A fill:#e1bee7
    style F fill:#c8e6c9
```

---

**Last Updated:** 2025-11-21
**Version:** 1.0.0
