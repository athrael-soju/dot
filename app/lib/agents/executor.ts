import { EntityTypes } from '../memory';

export const createAddEpisodeTool = (sessionId: string) => ({
    type: 'function' as const,
    name: 'add_episode',
    description: 'Save a new memory to the knowledge graph. Use ONLY for genuinely new information: user preferences, important facts, decisions, or context needed for future conversations. Before saving, check if this information already exists using search_nodes or search_facts to avoid duplicates.',
    parameters: {
        type: 'object' as const,
        properties: {
            name: {
                type: 'string',
                description: 'A short title for the memory/episode'
            },
            description: {
                type: 'string',
                description: 'A summary of the conversation or fact to store. This is the main content of the memory.'
            },
            source: {
                type: 'string',
                enum: ['message', 'json', 'text'],
                description: 'The source type. Use "message" for conversation interactions.'
            },
            source_description: {
                type: 'string',
                description: 'Context about where this information came from (e.g., "User chat")'
            },
            group_id: {
                type: 'string',
                description: 'The user ID or group ID to namespace the data. Use "user_default" if not sure.'
            }
        },
        required: ['name', 'description', 'source', 'group_id'],
        additionalProperties: false
    },
    invoke: async (_context: any, input: string) => {
        // Create AbortController to handle disconnection during fetch
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const args = JSON.parse(input);
            console.log('Executing add_episode:', args);

            // Call server-side API route with abort signal
            const response = await fetch('/api/memory/add-episode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: args.name,
                    description: args.description,
                    source: args.source,
                    source_description: args.source_description,
                    group_id: args.group_id,
                    session_id: sessionId
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to add episode');
            }

            return JSON.stringify(result);
        } catch (error: any) {
            clearTimeout(timeout);

            // Handle abort gracefully
            if (error.name === 'AbortError') {
                console.error('add_episode request aborted');
                return JSON.stringify({ error: 'Request cancelled or timed out' });
            }

            console.error('Error in add_episode tool:', error);
            return JSON.stringify({ error: error.message });
        }
    },
    strict: false,
    needsApproval: async () => false,
});

export const searchNodesTool = {
    type: 'function' as const,
    name: 'search_nodes',
    description: 'Search for specific entities in memory using semantic search. Use this to find: user preferences, personal details, topics of interest, locations, requirements, etc. Returns structured entities extracted from past conversations. Use this to CHECK if information already exists before saving new episodes.',
    parameters: {
        type: 'object' as const,
        properties: {
            query: { 
                type: 'string', 
                description: 'The search query to find relevant entities' 
            },
            group_id: { 
                type: 'string', 
                description: 'The user ID or group ID to search within' 
            },
            entity_types: {
                type: 'array',
                items: { type: 'string', enum: EntityTypes },
                description: 'Filter by specific entity types (e.g., Preference, Location, etc.)'
            }
        },
        required: ['query', 'group_id'],
        additionalProperties: false
    },
    invoke: async (_context: any, input: string) => {
        console.log('Tool invoked: search_nodes with input:', input);

        // Create AbortController to handle disconnection during fetch
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const args = JSON.parse(input);
            console.log('Executing search_nodes:', args);

            // Call server-side API route with abort signal
            const response = await fetch('/api/memory/search-nodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: args.query,
                    group_id: args.group_id,
                    entity_types: args.entity_types
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to search nodes');
            }

            return JSON.stringify(result);
        } catch (error: any) {
            clearTimeout(timeout);

            // Handle abort gracefully
            if (error.name === 'AbortError') {
                console.error('search_nodes request aborted');
                return JSON.stringify({ error: 'Request cancelled or timed out' });
            }

            console.error('Error in search_nodes tool:', error);
            return JSON.stringify({ error: error.message });
        }
    },
    strict: false,
    needsApproval: async () => false,
};

export const searchFactsTool = {
    type: 'function' as const,
    name: 'search_facts',
    description: 'Search for relationships and connections between entities using semantic search. Use this to find: how entities relate to each other, historical facts, past decisions, and contextual connections. Returns relationship edges (e.g., "User prefers X", "User works at Y"). Complements search_nodes by showing how things connect.',
    parameters: {
        type: 'object' as const,
        properties: {
            query: { 
                type: 'string', 
                description: 'The search query to find relevant facts' 
            },
            group_id: { 
                type: 'string', 
                description: 'The user ID or group ID to search within' 
            }
        },
        required: ['query', 'group_id'],
        additionalProperties: false
    },
    invoke: async (_context: any, input: string) => {
        // Create AbortController to handle disconnection during fetch
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const args = JSON.parse(input);
            console.log('Executing search_facts:', args);

            // Call server-side API route with abort signal
            const response = await fetch('/api/memory/search-facts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: args.query,
                    group_id: args.group_id
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to search facts');
            }

            return JSON.stringify(result);
        } catch (error: any) {
            clearTimeout(timeout);

            // Handle abort gracefully
            if (error.name === 'AbortError') {
                console.error('search_facts request aborted');
                return JSON.stringify({ error: 'Request cancelled or timed out' });
            }

            console.error('Error in search_facts tool:', error);
            return JSON.stringify({ error: error.message });
        }
    },
    strict: false,
    needsApproval: async () => false,
};

export const deleteEpisodeTool = {
    type: 'function' as const,
    name: 'delete_episode',
    description: 'Delete a specific episode (memory) from the graph by its UUID.',
    parameters: {
        type: 'object' as const,
        properties: {
            uuid: { 
                type: 'string', 
                description: 'The UUID of the episode to delete' 
            }
        },
        required: ['uuid'],
        additionalProperties: false
    },
    invoke: async (_context: any, input: string) => {
        // Create AbortController to handle disconnection during fetch
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const args = JSON.parse(input);
            console.log('Executing delete_episode:', args);

            // Call server-side API route with abort signal
            const response = await fetch('/api/memory/delete-episode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid: args.uuid }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete episode');
            }

            return JSON.stringify(result);
        } catch (error: any) {
            clearTimeout(timeout);

            // Handle abort gracefully
            if (error.name === 'AbortError') {
                console.error('delete_episode request aborted');
                return JSON.stringify({ error: 'Request cancelled or timed out' });
            }

            console.error('Error in delete_episode tool:', error);
            return JSON.stringify({ error: error.message });
        }
    },
    strict: false,
    needsApproval: async () => false,
};

export const deleteEntityEdgeTool = {
    type: 'function' as const,
    name: 'delete_entity_edge',
    description: 'Delete a specific fact/relationship (entity edge) from the graph by its UUID.',
    parameters: {
        type: 'object' as const,
        properties: {
            uuid: { 
                type: 'string', 
                description: 'The UUID of the entity edge to delete' 
            }
        },
        required: ['uuid'],
        additionalProperties: false
    },
    invoke: async (_context: any, input: string) => {
        // Create AbortController to handle disconnection during fetch
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const args = JSON.parse(input);
            console.log('Executing delete_entity_edge:', args);

            // Call server-side API route with abort signal
            const response = await fetch('/api/memory/delete-entity-edge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid: args.uuid }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete entity edge');
            }

            return JSON.stringify(result);
        } catch (error: any) {
            clearTimeout(timeout);

            // Handle abort gracefully
            if (error.name === 'AbortError') {
                console.error('delete_entity_edge request aborted');
                return JSON.stringify({ error: 'Request cancelled or timed out' });
            }

            console.error('Error in delete_entity_edge tool:', error);
            return JSON.stringify({ error: error.message });
        }
    },
    strict: false,
    needsApproval: async () => false,
};

export const forgetAllTool = {
    type: 'function' as const,
    name: 'forget_all',
    description: 'Clear all memories from the knowledge graph. CRITICAL: This is IRREVERSIBLE and will delete ALL episodes, entities, and facts. Only use when the user explicitly requests to forget everything. You MUST ask the user to confirm they are certain before calling this tool.',
    parameters: {
        type: 'object' as const,
        properties: {
            group_id: {
                type: 'string',
                description: 'The user ID or group ID to clear memories for. Use "user_default" for the current user.'
            },
            confirmed: {
                type: 'boolean',
                description: 'Must be true. Only set to true after the user has explicitly confirmed they want to delete all memories.'
            }
        },
        required: ['group_id', 'confirmed'],
        additionalProperties: false
    },
    invoke: async (_context: any, input: string) => {
        console.log('Tool invoked: forget_all with input:', input);
        try {
            const args = JSON.parse(input);
            console.log('Executing forget_all:', args);

            if (!args.confirmed) {
                return JSON.stringify({
                    error: 'User confirmation required. Ask the user if they are certain before proceeding.'
                });
            }

            // Directly delete the entire graph for this group using FalkorDB
            // This is much more efficient than deleting episodes one by one
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

            try {
                const response = await fetch('/api/memory/forget', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ group_id: args.group_id }),
                    signal: controller.signal
                });

                clearTimeout(timeout);
                const result = await response.json();

                if (!response.ok) {
                    console.error('Error deleting graph:', result.error);
                    throw new Error(result.error || 'Failed to delete memories');
                }

                console.log('Successfully deleted entire graph for group:', args.group_id);
                return JSON.stringify(result);
            } catch (deleteError: any) {
                clearTimeout(timeout);

                // Handle abort gracefully
                if (deleteError.name === 'AbortError') {
                    console.error('forget_all request aborted');
                    throw new Error('Request cancelled or timed out');
                }

                console.error('Error during graph deletion:', deleteError);
                throw new Error(`Failed to clear memories: ${deleteError.message}`);
            }
        } catch (error: any) {
            console.error('Error in forget_all tool:', error);
            return JSON.stringify({ error: error.message });
        }
    },
    strict: false,
    needsApproval: async () => false,
};

export const getEpisodesTool = {
    type: 'function' as const,
    name: 'get_episodes',
    description: 'Retrieve recent episodes chronologically (most recent first). Use this at startup to understand "what happened recently" and get temporal context. Unlike search_nodes/search_facts which do semantic search, this returns episodes in time order. Use max_episodes to control how many to retrieve (default: 10, recommend: 15-20 for startup).',
    parameters: {
        type: 'object' as const,
        properties: {
            group_id: { 
                type: 'string', 
                description: 'The user ID or group ID to retrieve episodes for' 
            },
            max_episodes: { 
                type: 'number', 
                description: 'Maximum number of episodes to return (default: 10)' 
            }
        },
        required: ['group_id'],
        additionalProperties: false
    },
    invoke: async (_context: any, input: string) => {
        console.log('Tool invoked: get_episodes with input:', input);

        // Create AbortController to handle disconnection during fetch
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const args = JSON.parse(input);
            console.log('Executing get_episodes:', args);

            // Call server-side API route with abort signal
            const response = await fetch('/api/memory/get-episodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: args.group_id,
                    max_episodes: args.max_episodes
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to get episodes');
            }

            return JSON.stringify(result);
        } catch (error: any) {
            clearTimeout(timeout);

            // Handle abort gracefully
            if (error.name === 'AbortError') {
                console.error('get_episodes request aborted');
                return JSON.stringify({ error: 'Request cancelled or timed out' });
            }

            console.error('Error in get_episodes tool:', error);
            return JSON.stringify({ error: error.message });
        }
    },
    strict: false,
    needsApproval: async () => false,
};
