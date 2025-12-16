/**
 * Tests for dndLogic.js functions
 */
import {
  sortByTime,
  reorder,
  move,
  rebuildDay,
  recalculateTimeSlots
} from '../../frontend/src/pages/MyTrips/dndLogic';

describe('dndLogic', () => {
  describe('sortByTime', () => {
    test('should sort items by time_slot in ascending order', () => {
      const items = [
        { id: 1, name: 'Place A', time_slot: '14:30:00' },
        { id: 2, name: 'Place B', time_slot: '08:00:00' },
        { id: 3, name: 'Place C', time_slot: '12:15:00' }
      ];

      const result = sortByTime(items);

      expect(result[0].id).toBe(2); // 08:00
      expect(result[1].id).toBe(3); // 12:15
      expect(result[2].id).toBe(1); // 14:30
    });

    test('should handle items without time_slot (place at end)', () => {
      const items = [
        { id: 1, name: 'Place A', time_slot: '10:00:00' },
        { id: 2, name: 'Place B' }, // No time_slot
        { id: 3, name: 'Place C', time_slot: '15:00:00' }
      ];

      const result = sortByTime(items);

      expect(result[0].id).toBe(1); // 10:00
      expect(result[1].id).toBe(3); // 15:00
      expect(result[2].id).toBe(2); // No time_slot (23:59)
    });

    test('should handle empty array', () => {
      const items = [];
      const result = sortByTime(items);
      expect(result).toEqual([]);
    });

    test('should handle null/undefined time_slot', () => {
      const items = [
        { id: 1, name: 'Place A', time_slot: null },
        { id: 2, name: 'Place B', time_slot: undefined },
        { id: 3, name: 'Place C', time_slot: '12:00:00' }
      ];

      const result = sortByTime(items);

      expect(result[0].id).toBe(3); // 12:00
      expect(result[1].id).toBe(1); // null (23:59)
      expect(result[2].id).toBe(2); // undefined (23:59)
    });
  });

  describe('reorder', () => {
    test('should move item from start to end', () => {
      const list = ['A', 'B', 'C', 'D'];
      const result = reorder(list, 0, 3);

      expect(result).toEqual(['B', 'C', 'D', 'A']);
    });

    test('should move item from end to start', () => {
      const list = ['A', 'B', 'C', 'D'];
      const result = reorder(list, 3, 0);

      expect(result).toEqual(['D', 'A', 'B', 'C']);
    });

    test('should move item within middle of list', () => {
      const list = ['A', 'B', 'C', 'D', 'E'];
      const result = reorder(list, 2, 4);

      expect(result).toEqual(['A', 'B', 'D', 'E', 'C']);
    });

    test('should not modify original array', () => {
      const list = ['A', 'B', 'C'];
      const original = [...list];
      reorder(list, 0, 2);

      expect(list).toEqual(original);
    });
  });

  describe('move', () => {
    test('should move item between different lists', () => {
      const source = [
        { id: 1, name: 'Place A', day: 1 },
        { id: 2, name: 'Place B', day: 1 }
      ];
      const destination = [
        { id: 3, name: 'Place C', day: 2 }
      ];
      const droppableSource = { droppableId: 'day-1', index: 0 };
      const droppableDestination = { droppableId: 'day-2', index: 1 };

      const result = move(source, destination, droppableSource, droppableDestination);

      expect(result['day-1']).toHaveLength(1);
      expect(result['day-1'][0].id).toBe(2);
      expect(result['day-2']).toHaveLength(2);
      expect(result['day-2'][0].id).toBe(3);
      expect(result['day-2'][1].id).toBe(1);
      expect(result['day-2'][1].day).toBe(2); // Updated day
    });

    test('should move item to beginning of destination', () => {
      const source = [{ id: 1, name: 'Place A', day: 1 }];
      const destination = [
        { id: 2, name: 'Place B', day: 2 },
        { id: 3, name: 'Place C', day: 2 }
      ];
      const droppableSource = { droppableId: 'day-1', index: 0 };
      const droppableDestination = { droppableId: 'day-2', index: 0 };

      const result = move(source, destination, droppableSource, droppableDestination);

      expect(result['day-1']).toHaveLength(0);
      expect(result['day-2']).toHaveLength(3);
      expect(result['day-2'][0].id).toBe(1);
      expect(result['day-2'][0].day).toBe(2);
    });

    test('should handle different droppableId formats', () => {
      const source = [{ id: 1, name: 'Place A', day: 1 }];
      const destination = [];
      const droppableSource = { droppableId: 'day-1', index: 0 };
      const droppableDestination = { droppableId: 'custom-day-5', index: 0 };

      const result = move(source, destination, droppableSource, droppableDestination);

      expect(result['custom-day-5'][0].day).toBe(5);
    });
  });

  describe('rebuildDay', () => {
    test('should rebuild day with valid places', async () => {
      const places = [
        {
          id: 1,
          name: 'Place A',
          time_slot: '10:00:00',
          duration: 60,
          category: 'Sightseeing'
        },
        {
          id: 2,
          name: 'Place B',
          time_slot: '14:00:00',
          duration: 90,
          category: 'Sightseeing'
        }
      ];

      const result = await rebuildDay(places, { defaultStart: '08:00:00' });

      expect(result).toHaveLength(2);
      expect(result[0].time_slot).toBeTruthy();
      expect(result[0].duration).toBeGreaterThanOrEqual(5);
    });

    test('should filter out travel items', async () => {
      const places = [
        { id: 1, name: 'Place A', category: 'Sightseeing', time_slot: '10:00:00', duration: 60 },
        { id: 2, name: 'Travel', category: 'Di chuyển', time_slot: '12:00:00', duration: 30 },
        { id: 3, name: 'Place B', category: 'Sightseeing', time_slot: '14:00:00', duration: 90 }
      ];

      const result = await rebuildDay(places);

      // Should filter out travel item
      expect(result.every(p => p.category !== 'Di chuyển' && p.category !== 'TRAVEL')).toBe(true);
    });

    test('should round duration to multiple of 5', async () => {
      const places = [
        { id: 1, name: 'Place A', duration: 63, category: 'Sightseeing' },
        { id: 2, name: 'Place B', duration: 2, category: 'Sightseeing' },
        { id: 3, name: 'Place C', duration: 87, category: 'Sightseeing' }
      ];

      const result = await rebuildDay(places);

      expect(result[0].duration).toBe(65); // 63 → 65
      expect(result[1].duration).toBe(5);  // 2 → 5 (min)
      expect(result[2].duration).toBe(85); // 87 → 85
    });

    test('should handle null places', async () => {
      const result = await rebuildDay(null);
      expect(result).toBeNull();
    });
  });

  describe('recalculateTimeSlots', () => {
    test('should preserve complete time_slot from AI', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, name: 'Place A', time_slot: '08:00-10:00' },
            { id: 2, name: 'Place B', time_slot: '10:30-12:00' }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].time_slot).toBe('08:00-10:00');
      expect(result[0].places[0].start_time).toBe('08:00');
    });

    test('should parse start_time and end_time from AI', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            {
              id: 1,
              name: 'Place A',
              start_time: '09:00',
              end_time: '11:00',
              duration_hours: 2
            }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].time_slot).toBe('09:00-11:00');
      expect(result[0].places[0].start_time).toBe('09:00');
      expect(result[0].places[0].end_time).toBe('11:00');
    });

    test('should calculate sequential time if no explicit time', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, name: 'Place A', duration_min: 90 },
            { id: 2, name: 'Place B', duration_hours: 2 }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].start_time).toBe('08:00');
      expect(result[0].places[0].time_slot).toMatch(/08:00-/);
      expect(result[0].places[1].start_time).toMatch(/09:30/); // After 90 minutes
    });

    test('should handle duration from different sources', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, name: 'Place A', duration_hours: 1.5 },
            { id: 2, name: 'Place B', duration_min: 120 },
            { id: 3, name: 'LUNCH', category: 'Ăn uống' }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].time_slot).toBeTruthy();
      expect(result[0].places[1].time_slot).toBeTruthy();
      expect(result[0].places[2].time_slot).toBeTruthy();
    });
  });
});

