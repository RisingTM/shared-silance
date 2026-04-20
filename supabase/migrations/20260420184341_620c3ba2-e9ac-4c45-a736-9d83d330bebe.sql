
CREATE OR REPLACE FUNCTION public.enforce_status_cooldown()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE last_at TIMESTAMPTZ;
BEGIN
  SELECT MAX(created_at) INTO last_at FROM public.daily_statuses WHERE user_id = NEW.user_id;
  IF last_at IS NOT NULL AND now() - last_at < INTERVAL '12 hours' THEN
    RAISE EXCEPTION 'You can only update your status once every 12 hours';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.block_letter_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Sealed letters cannot be modified or deleted'; END $$;
