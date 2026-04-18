const { Router } = require('express');
const supabase = require('../services/supabase');

const router = Router();

router.post('/rooms', async (req, res) => {
  const { guest_id } = req.body;
  if (!guest_id) {
    return res.status(400).json({ error: 'guest_id is required' });
  }

  const { data, error } = await supabase
    .from('chat_rooms')
    .insert({ guest_id, status: 'auto' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.get('/rooms/:id/messages', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
