import { Request, Response } from 'express';

type Room = {
    id: string;
    name: string;
    capacity: number;
    color: string;
};

export const list = async (_req: Request, res: Response) => {
    const rooms: Room[] = [
        { id: '1', name: 'Salón Principal', capacity: 30, color: '#8B5CF6' },
        { id: '2', name: 'Salón de Cuerdas', capacity: 15, color: '#3B82F6' },
        { id: '3', name: 'Aula de Teoría', capacity: 20, color: '#10B981' },
        { id: '4', name: 'Sala de Coro', capacity: 25, color: '#F59E0B' }
    ];

    return res.json({
        success: true,
        data: rooms
    });
};
