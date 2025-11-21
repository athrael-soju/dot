import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
        const { group_id } = await request.json();

        if (!group_id) {
            return NextResponse.json(
                { error: 'group_id is required' },
                { status: 400 }
            );
        }

        console.log('[API] Deleting graph for group:', group_id);

        // Execute Cypher query to delete all nodes and relationships for this group in Neo4j
        const cypherQuery = `MATCH (n) WHERE n.group_id = '${group_id}' DETACH DELETE n`;
        const command = `docker exec plucky-neo4j-1 cypher-shell -u neo4j -p demodemo --format plain "MATCH (n) WHERE n.group_id = '${group_id}' DETACH DELETE n"`;
        console.log('[API] Executing command:', command);

        const { stdout, stderr } = await execAsync(command);

        if (stderr && !stderr.toLowerCase().includes('deleted')) {
            console.error('[API] Error deleting graph:', stderr);
            // Note: Neo4j cypher-shell may output to stderr even on success, so we check for error indicators
            if (stderr.toLowerCase().includes('error') || stderr.toLowerCase().includes('failed')) {
                return NextResponse.json(
                    { error: `Failed to delete graph: ${stderr}` },
                    { status: 500 }
                );
            }
        }

        console.log('[API] Successfully deleted graph:', stdout, stderr);

        return NextResponse.json({
            success: true,
            message: 'All memories have been permanently deleted.',
            group_id
        });
    } catch (error: any) {
        console.error('[API] Error in forget endpoint:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete memories' },
            { status: 500 }
        );
    }
}
