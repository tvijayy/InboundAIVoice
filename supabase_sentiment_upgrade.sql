-- Add sentiment_category column to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS sentiment_category text DEFAULT 'Neutral';

-- Index for analytics performance
CREATE INDEX IF NOT EXISTS idx_sentiment_category ON calls(sentiment_category);
