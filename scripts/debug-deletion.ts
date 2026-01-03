
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = 'a4b92675-5cea-4e26-a581-2e7fcd9c4789'; // Mark
const matchId = 'bd7e742e-137a-43c2-a9b0-9c2e0b7a8d5f'; // Guessing match ID from message or I can find it

async function test() {
  // 1. Get the match ID from the message
  const { data: msg } = await supabase
    .from('messages')
    .select('match_id')
    .eq('id', 'e9741569-166d-4742-bd85-b185db352ff4')
    .single();

  if (!msg) {
    console.log('Message not found');
    return;
  }
  
  const matchId = msg.match_id;
  console.log('Match ID:', matchId);

  // 2. Fetch all messages
  const { data: allMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false });

  console.log(`Fetched ${allMessages?.length} messages`);

  // 3. Fetch deletions
  const { data: deletions } = await supabase
    .from('message_deletions')
    .select('message_id')
    .eq('user_id', userId);

  console.log(`Fetched ${deletions?.length} deletions`);
  
  const deletedIds = new Set(deletions?.map(d => d.message_id));
  console.log('Deleted IDs:', Array.from(deletedIds));

  // 4. Filter
  const filteredMessages = allMessages?.filter(m => !deletedIds.has(m.id));
  
  // 5. Check if the image message is present
  const imageMsgId = 'e9741569-166d-4742-bd85-b185db352ff4';
  const found = filteredMessages?.find(m => m.id === imageMsgId);

  if (found) {
    console.log('FAIL: Image message still present in filtered list!');
  } else {
    console.log('SUCCESS: Image message was filtered out.');
  }
}

test();
