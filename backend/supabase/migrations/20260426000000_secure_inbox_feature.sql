-- ==========================================
-- MESSAGING & INBOX SCHEMA
-- With anti-disintermediation (contact info filtering)
-- ==========================================

-- 1. Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    participant_one UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    participant_two UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(participant_one, participant_two)
);

-- 2. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE, -- Flagged for contact info
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(participant_one, participant_two);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations Policies
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations" ON public.conversations
FOR SELECT TO authenticated
USING (auth.uid() = participant_one OR auth.uid() = participant_two);

DROP POLICY IF EXISTS "Users can insert conversations they participate in" ON public.conversations;
CREATE POLICY "Users can insert conversations they participate in" ON public.conversations
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);

-- Messages Policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE id = messages.conversation_id 
        AND (participant_one = auth.uid() OR participant_two = auth.uid())
    )
);

DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
CREATE POLICY "Users can insert messages in their conversations" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE id = messages.conversation_id 
        AND (participant_one = auth.uid() OR participant_two = auth.uid())
    )
);

-- 3. Anti-Disintermediation Filter (Database Level)
-- This function flags messages that likely contain phone numbers or emails
CREATE OR REPLACE FUNCTION public.filter_contact_info()
RETURNS TRIGGER AS $$
DECLARE
    contact_pattern TEXT := '(\+?\d{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}';
BEGIN
    -- Flag the message if it matches the pattern
    IF NEW.content ~ contact_pattern THEN
        NEW.is_flagged := TRUE;
    END IF;
    
    -- Update the last_message_at in the conversation
    UPDATE public.conversations 
    SET last_message_at = NOW() 
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.filter_contact_info();
