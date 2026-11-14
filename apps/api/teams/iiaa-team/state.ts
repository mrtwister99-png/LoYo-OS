import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

const STATE_PATH = path.join(process.cwd(), 'data/capabilities/teams/iiaa-team/1start/state.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf-8');
    const state = JSON.parse(raw);
    return res.status(200).json(state);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
