/**
 * Extended tests for advanced dndLogic.js functions
 * Testing: time swapping, rebuild logic, and auto-time calculations
 */
import {
  sortByTime,
  reorder,
  move,
  rebuildDay,
  recalculateTimeSlots
} from '@/pages/MyTrips/dndLogic';

describe('dndLogic - Advanced Features', () => {
  describe('reorder with time swapping', () => {
    test('should swap time slots when reordering items with time', () => {
      const list = [
        { id: 1, name: 'Place A', time_slot: '08:00-10:00', start_time: '08:00' },
        { id: 2, name: 'Place B', time_slot: '10:00-12:00', start_time: '10:00' },
        { id: 3, name: 'Place C', time_slot: '12:00-14:00', start_time: '12:00' }
      ];

      const result = reorder(list, 0, 2);

      // Item A moved to position 2 should have C's time
      expect(result[2].id).toBe(1);
      expect(result[2].time_slot).toBe('12:00-14:00');
      expect(result[2].start_time).toBe('12:00');

      // Item C at position 0 should have A's time
      expect(result[0].id).toBe(2);
      expect(result[0].time_slot).toBe('08:00-10:00');
      expect(result[0].start_time).toBe('08:00');
    });

    test('should not swap time when items lack time_slot', () => {
      const list = [
        { id: 1, name: 'Place A' },
        { id: 2, name: 'Place B' },
        { id: 3, name: 'Place C' }
      ];

      const result = reorder(list, 0, 2);

      expect(result[2].id).toBe(1);
      expect(result[2].time_slot).toBeUndefined();
    });

    test('should handle partial time data', () => {
      const list = [
        { id: 1, name: 'Place A', time_slot: '08:00-10:00' },
        { id: 2, name: 'Place B' },
        { id: 3, name: 'Place C', time_slot: '12:00-14:00' }
      ];

      const result = reorder(list, 0, 2);

      // Should only swap when both have time
      expect(result[2].id).toBe(1);
      expect(result[2].time_slot).toBe('08:00-10:00');
    });

    test('should preserve original array', () => {
      const list = [
        { id: 1, time_slot: '08:00-10:00' },
        { id: 2, time_slot: '10:00-12:00' }
      ];
      const original = JSON.parse(JSON.stringify(list));

      reorder(list, 0, 1);

      expect(list).toEqual(original);
    });

    test('should handle adjacent swaps', () => {
      const list = [
        { id: 1, time_slot: '08:00-09:00', start_time: '08:00' },
        { id: 2, time_slot: '09:00-10:00', start_time: '09:00' }
      ];

      const result = reorder(list, 0, 1);

      expect(result[0].id).toBe(2);
      expect(result[0].time_slot).toBe('08:00-09:00');
      expect(result[1].id).toBe(1);
      expect(result[1].time_slot).toBe('09:00-10:00');
    });
  });

  describe('rebuildDay - advanced time management', () => {
    test('should maintain swapped times after rebuild', () => {
      const places = [
        { id: 1, name: 'Place A', time_slot: '10:00-11:30', duration: 90, category: 'Sightseeing' },
        { id: 2, name: 'Place B', time_slot: '08:00-09:30', duration: 90, category: 'Sightseeing' }
      ];

      const result = rebuildDay(places);

      // Should preserve existing time slots (not re-sort)
      expect(result[0].time_slot).toBe('10:00-11:30');
      expect(result[1].time_slot).toBe('08:00-09:30');
    });

    test('should adjust overlapping times sequentially', () => {
      const places = [
        { id: 1, time_slot: '08:00-09:00', duration: 60, category: 'Sightseeing' },
        { id: 2, time_slot: '08:30-09:30', duration: 60, category: 'Sightseeing' }
      ];

      const result = rebuildDay(places);

      // First item keeps its time
      expect(result[0].time_slot).toBe('08:00-09:00');
      // Second item should be adjusted to after first
      expect(result[1].time_slot).toBe('09:00-10:00');
    });

    test('should use default start time for first item without time', () => {
      const places = [
        { id: 1, duration: 60, category: 'Sightseeing' },
        { id: 2, duration: 60, category: 'Sightseeing' }
      ];

      const result = rebuildDay(places, { defaultStart: '09:00:00' });

      expect(result[0].time_slot).toMatch(/^09:00/);
      expect(result[1].time_slot).toMatch(/^10:00/);
    });

    test('should round duration to nearest 5 minutes', () => {
      const places = [
        { id: 1, duration: 67, category: 'Sightseeing' },
        { id: 2, duration: 3, category: 'Sightseeing' },
        { id: 3, duration: 123, category: 'Sightseeing' }
      ];

      const result = rebuildDay(places);

      expect(result[0].duration).toBe(65);
      expect(result[1].duration).toBe(5); // Minimum 5
      expect(result[2].duration).toBe(125);
    });

    test('should filter out travel items', () => {
      const places = [
        { id: 1, category: 'Sightseeing' },
        { id: 2, category: 'Di chuyển' },
        { id: 3, category: 'TRAVEL' },
        { id: 4, category: 'Sightseeing' }
      ];

      const result = rebuildDay(places);

      expect(result).toHaveLength(2);
      expect(result.every(p => p.category === 'Sightseeing')).toBe(true);
    });

    test('should handle empty places array', () => {
      const result = rebuildDay([]);
      expect(result).toEqual([]);
    });

    test('should preserve order without sorting', () => {
      const places = [
        { id: 3, time_slot: '14:00-15:00', duration: 60, category: 'Sightseeing' },
        { id: 1, time_slot: '08:00-09:00', duration: 60, category: 'Sightseeing' },
        { id: 2, time_slot: '10:00-11:00', duration: 60, category: 'Sightseeing' }
      ];

      const result = rebuildDay(places);

      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(1);
      expect(result[2].id).toBe(2);
    });
  });

  describe('recalculateTimeSlots - auto-time calculations', () => {
    test('should preserve complete AI time slots', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, time_slot: '08:00-10:00', name: 'Place A' },
            { id: 2, time_slot: '10:30-12:00', name: 'Place B' }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].time_slot).toBe('08:00-10:00');
      expect(result[0].places[0].start_time).toBe('08:00');
      expect(result[0].places[1].time_slot).toBe('10:30-12:00');
    });

    test('should calculate time from start_time and duration', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, start_time: '09:00', duration_hours: 2, name: 'Place A' }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].time_slot).toBe('09:00-11:00');
      expect(result[0].places[0].start_time).toBe('09:00');
      expect(result[0].places[0].end_time).toBe('11:00');
    });

    test('should use end_time when provided', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { 
              id: 1, 
              start_time: '09:00', 
              end_time: '11:30',
              name: 'Place A' 
            }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].time_slot).toBe('09:00-11:30');
      expect(result[0].places[0].end_time).toBe('11:30');
    });

    test('should calculate sequential times when no explicit time', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, duration_min: 90, name: 'Place A' },
            { id: 2, duration_hours: 1, name: 'Place B' }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].start_time).toBe('08:00');
      expect(result[0].places[0].time_slot).toBe('08:00-09:30');
      expect(result[0].places[1].start_time).toBe('09:30');
      expect(result[0].places[1].time_slot).toBe('09:30-10:30');
    });

    test('should handle lunch and travel with default durations', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 'LUNCH', category: 'Ăn uống', name: 'Lunch' },
            { id: 'TRAVEL', category: 'Di chuyển', name: 'Travel' }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      // Lunch default: 60 min
      expect(result[0].places[0].time_slot).toBe('08:00-09:00');
      // Travel default: 45 min
      expect(result[0].places[1].time_slot).toBe('09:00-09:45');
    });

    test('should handle times beyond 24 hours', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, start_time: '23:00', duration_hours: 3, name: 'Late Night' }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      // Should allow 26:00 (2 AM next day)
      expect(result[0].places[0].time_slot).toBe('23:00-26:00');
    });

    test('should use first items start_time as base', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, start_time: '10:00', duration_min: 60, name: 'Place A' },
            { id: 2, duration_min: 60, name: 'Place B' }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].start_time).toBe('10:00');
      expect(result[0].places[1].start_time).toBe('11:00');
    });

    test('should handle multiple days independently', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, start_time: '09:00', duration_min: 60 }
          ]
        },
        {
          day: 2,
          places: [
            { id: 2, start_time: '10:00', duration_min: 60 }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].start_time).toBe('09:00');
      expect(result[1].places[0].start_time).toBe('10:00');
    });

    test('should default to 90 minutes for sightseeing', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, name: 'Museum', category: 'Sightseeing' }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      // Should use 90 min default
      expect(result[0].places[0].time_slot).toBe('08:00-09:30');
    });

    test('should handle empty places array', () => {
      const itinerary = [
        {
          day: 1,
          places: []
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places).toEqual([]);
    });

    test('should preserve item order from AI', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 3, name: 'Third', start_time: '14:00', duration_min: 60 },
            { id: 1, name: 'First', start_time: '08:00', duration_min: 60 },
            { id: 2, name: 'Second', start_time: '10:00', duration_min: 60 }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].id).toBe(3);
      expect(result[0].places[1].id).toBe(1);
      expect(result[0].places[2].id).toBe(2);
    });

    test('should handle mixed time formats', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, time_slot: '8:00-10:00', name: 'Place A' },
            { id: 2, start_time: '10:30', end_time: '12:0', name: 'Place B' }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      expect(result[0].places[0].time_slot).toBe('8:00-10:00');
      expect(result[0].places[1].time_slot).toBe('10:30-12:00');
    });

    test('should handle duration_hours conversion', () => {
      const itinerary = [
        {
          day: 1,
          places: [
            { id: 1, duration_hours: 2.5, name: 'Place A' }
          ]
        }
      ];

      const result = recalculateTimeSlots(itinerary);

      // 2.5 hours = 150 minutes
      expect(result[0].places[0].time_slot).toBe('08:00-10:30');
    });
  });

  describe('move - cross-day operations', () => {
    test('should update day number when moving between days', () => {
      const source = [
        { id: 1, day: 1, name: 'Place A' }
      ];
      const destination = [
        { id: 2, day: 2, name: 'Place B' }
      ];

      const result = move(
        source,
        destination,
        { droppableId: 'day-1', index: 0 },
        { droppableId: 'day-2', index: 1 }
      );

      expect(result['day-2'][1].day).toBe(2);
    });

    test('should handle custom droppableId format', () => {
      const source = [{ id: 1, day: 1 }];
      const destination = [];

      const result = move(
        source,
        destination,
        { droppableId: 'day-1', index: 0 },
        { droppableId: 'custom-day-10', index: 0 }
      );

      expect(result['custom-day-10'][0].day).toBe(10);
    });

    test('should empty source after move', () => {
      const source = [{ id: 1, day: 1 }];
      const destination = [];

      const result = move(
        source,
        destination,
        { droppableId: 'day-1', index: 0 },
        { droppableId: 'day-2', index: 0 }
      );

      expect(result['day-1']).toHaveLength(0);
    });
  });
});