import { describe, it, expect, vi } from 'vitest'; 
import { Orchestrator } from '../src/orchestrator/orchestrator'; 

describe('Orchestrator', () => { 
  it('batches prompts', async () => { 
    const mockAdapter = { id: 'mock', sendPrompt: vi.fn().mockResolvedValue({ok: true, text: 'mock'}) }; 
    const orch = new Orchestrator([mockAdapter]); 
    const res = await orch.batchPrompt('test'); 
    expect(res.raw[0].text).toBe('mock'); 
  }); 
});