CREATE TABLE public.securepay_demo_transaction_requests (
    idempotency_key uuid NOT NULL,
    payload_hash varchar(64) NOT NULL,
    transaction_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT securepay_demo_transaction_requests_pkey PRIMARY KEY (idempotency_key),
    CONSTRAINT securepay_demo_transaction_requests_payload_hash_check
        CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT securepay_demo_transaction_requests_transaction_id_key UNIQUE (transaction_id),
    CONSTRAINT securepay_demo_transaction_requests_transaction_id_fkey
        FOREIGN KEY (transaction_id)
        REFERENCES public.transactions(id)
        ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION public.create_demo_transaction_atomic(
    p_idempotency_key uuid,
    p_payload_hash text,
    p_user_id uuid,
    p_account_id uuid,
    p_recipient_name text,
    p_recipient_upi text,
    p_amount numeric,
    p_transaction_type text,
    p_recipient_type text,
    p_risk_score integer,
    p_risk_level text,
    p_amount_risk integer,
    p_behaviour_risk integer,
    p_recipient_risk integer,
    p_frequency_risk integer,
    p_explanation text,
    p_final_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_saved_payload_hash varchar(64);
    v_saved_transaction_id uuid;
    v_transaction public.transactions%ROWTYPE;
    v_risk public.transaction_risk%ROWTYPE;
    v_reference_number varchar(50);
    v_transaction_time timestamptz := now();
    v_risk_decision varchar(30);
    v_severity varchar(20);
    v_inserted integer;
BEGIN
    IF p_idempotency_key IS NULL OR p_user_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Required transaction identifiers are missing';
    END IF;
    IF p_recipient_name IS NULL OR length(btrim(p_recipient_name)) = 0 OR length(p_recipient_name) > 100 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Recipient name must be between 1 and 100 characters';
    END IF;
    IF p_recipient_upi IS NULL OR length(btrim(p_recipient_upi)) = 0 OR length(p_recipient_upi) > 100 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Recipient UPI must be between 1 and 100 characters';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 OR p_amount <> round(p_amount, 2) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Transaction amount must be positive and have no more than two decimal places';
    END IF;
    IF p_transaction_type IS NULL
        OR p_transaction_type NOT IN ('UPI', 'Bank Transfer', 'Bill Payment', 'Recharge')
        OR p_recipient_type IS NULL
        OR p_recipient_type NOT IN ('New', 'Existing')
        OR p_final_status IS NULL
        OR p_final_status NOT IN ('Success', 'Pending', 'Failed', 'Flagged', 'Verification Required') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Transaction type, recipient type, or status is invalid';
    END IF;
    IF p_risk_score IS NULL OR p_risk_score < 0 OR p_risk_score > 100
        OR p_amount_risk IS NULL OR p_amount_risk < 0 OR p_amount_risk > 100
        OR p_behaviour_risk IS NULL OR p_behaviour_risk < 0 OR p_behaviour_risk > 100
        OR p_recipient_risk IS NULL OR p_recipient_risk < 0 OR p_recipient_risk > 100
        OR p_frequency_risk IS NULL OR p_frequency_risk < 0 OR p_frequency_risk > 100 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Risk scores must be between 0 and 100';
    END IF;
    IF p_risk_level IS DISTINCT FROM
        CASE WHEN p_risk_score < 30 THEN 'Low' WHEN p_risk_score < 60 THEN 'Medium' ELSE 'High' END THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Risk level does not match the risk score';
    END IF;
    IF p_explanation IS NULL OR length(btrim(p_explanation)) = 0 OR length(p_explanation) > 1000 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Risk explanation must be between 1 and 1000 characters';
    END IF;

    v_reference_number := 'SP' || upper(replace(p_idempotency_key::text, '-', ''));
    v_risk_decision := CASE
        WHEN p_risk_score < 30 THEN 'APPROVE'
        WHEN p_risk_score < 80 THEN 'VERIFY'
        ELSE 'FLAG'
    END;
    IF p_payload_hash IS NULL OR p_payload_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A SHA-256 transaction payload hash is required';
    END IF;

    INSERT INTO public.securepay_demo_transaction_requests (
        idempotency_key,
        payload_hash
    )
    VALUES (p_idempotency_key, p_payload_hash)
    ON CONFLICT (idempotency_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    SELECT payload_hash, transaction_id
    INTO v_saved_payload_hash, v_saved_transaction_id
    FROM public.securepay_demo_transaction_requests
    WHERE idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF v_inserted = 0 THEN
        IF v_saved_payload_hash IS DISTINCT FROM p_payload_hash THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IDEMPOTENCY_CONFLICT';
        END IF;
        IF v_saved_transaction_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IDEMPOTENCY_RECORD_INCOMPLETE';
        END IF;

        SELECT * INTO v_transaction
        FROM public.transactions
        WHERE id = v_saved_transaction_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IDEMPOTENCY_TRANSACTION_MISSING';
        END IF;

        SELECT * INTO v_risk
        FROM public.transaction_risk
        WHERE transaction_id = v_saved_transaction_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IDEMPOTENCY_RISK_RECORD_MISSING';
        END IF;

        RETURN jsonb_build_object(
            'created', false,
            'transaction', to_jsonb(v_transaction) || jsonb_build_object('risk', to_jsonb(v_risk))
        );
    END IF;

    PERFORM 1
    FROM public.accounts
    WHERE id = p_account_id
      AND user_id = p_user_id
      AND status = 'Active'
    FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTIVE_DEMO_ACCOUNT_NOT_FOUND';
    END IF;
    IF EXISTS (SELECT 1 FROM public.transactions WHERE id = p_idempotency_key) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'IDEMPOTENCY_CONFLICT';
    END IF;

    INSERT INTO public.transactions (
        id,
        amount,
        transaction_type,
        reference_number,
        recipient_type,
        status,
        recipient_upi,
        recipient_name,
        account_id,
        transaction_time
    )
    VALUES (
        p_idempotency_key,
        p_amount,
        p_transaction_type,
        v_reference_number,
        p_recipient_type,
        p_final_status,
        p_recipient_upi,
        p_recipient_name,
        p_account_id,
        v_transaction_time
    )
    RETURNING * INTO v_transaction;

    INSERT INTO public.transaction_risk (
        transaction_id,
        risk_score,
        risk_level,
        decision,
        amount_risk,
        frequency_risk,
        recipient_risk,
        behaviour_risk,
        explanation,
        analysed_at
    )
    VALUES (
        v_transaction.id,
        p_risk_score,
        p_risk_level,
        v_risk_decision,
        p_amount_risk,
        p_frequency_risk,
        p_recipient_risk,
        p_behaviour_risk,
        p_explanation,
        v_transaction_time
    )
    RETURNING * INTO v_risk;

    INSERT INTO public.security_checks (
        user_id,
        check_type,
        result,
        risk_score,
        explanation,
        created_at
    )
    VALUES (
        p_user_id,
        'TRANSACTION',
        v_risk_decision,
        p_risk_score,
        p_explanation,
        v_transaction_time
    );

    INSERT INTO public.security_activity (
        user_id,
        related_transaction_id,
        activity_type,
        description,
        created_at
    )
    VALUES (
        p_user_id,
        v_transaction.id,
        'TRANSACTION_ANALYSED',
        format('Simulated transaction risk assessment completed: %s risk (%s/100). No funds were transferred.', p_risk_level, p_risk_score),
        v_transaction_time
    );

    IF p_final_status = 'Success' THEN
        INSERT INTO public.security_checks (
            user_id,
            check_type,
            result,
            risk_score,
            explanation,
            created_at
        )
        VALUES (
            p_user_id,
            'TRANSACTION',
            'VERIFICATION_COMPLETED',
            NULL,
            'Simulated transaction verification completed. No funds were transferred.',
            v_transaction_time
        );

        INSERT INTO public.security_activity (
            user_id,
            related_transaction_id,
            activity_type,
            description,
            created_at
        )
        VALUES (
            p_user_id,
            v_transaction.id,
            'VERIFICATION_COMPLETED',
            format('Simulated verification completed for transaction %s. No funds were transferred.', v_reference_number),
            v_transaction_time
        );
    ELSIF p_final_status = 'Flagged' THEN
        v_severity := CASE WHEN p_risk_score >= 80 THEN 'Critical' ELSE 'High' END;

        INSERT INTO public.security_alerts (
            user_id,
            transaction_id,
            title,
            message,
            alert_type,
            severity,
            status,
            recommendation,
            created_at
        )
        VALUES (
            p_user_id,
            v_transaction.id,
            'High-risk demo transaction blocked',
            format('A simulated payment of ₹%s to %s was blocked by the demo risk assessment. No funds were transferred.', to_char(p_amount, 'FM999,999,999,990.00'), p_recipient_name),
            'HIGH_RISK_TRANSACTION',
            v_severity,
            'Unread',
            'Review the transaction risk details before trying another demo payment.',
            v_transaction_time
        );

        INSERT INTO public.security_checks (
            user_id,
            check_type,
            result,
            risk_score,
            explanation,
            created_at
        )
        VALUES (
            p_user_id,
            'TRANSACTION',
            'FLAGGED',
            p_risk_score,
            'Simulated transaction was blocked by the local demo risk assessment.',
            v_transaction_time
        );

        INSERT INTO public.security_activity (
            user_id,
            related_transaction_id,
            activity_type,
            description,
            created_at
        )
        VALUES (
            p_user_id,
            v_transaction.id,
            'RISK_ALERT',
            format('High-risk simulated transaction %s was blocked. No funds were transferred.', v_reference_number),
            v_transaction_time
        );
    END IF;

    UPDATE public.securepay_demo_transaction_requests
    SET transaction_id = v_transaction.id
    WHERE idempotency_key = p_idempotency_key;

    RETURN jsonb_build_object(
        'created', true,
        'transaction', to_jsonb(v_transaction) || jsonb_build_object('risk', to_jsonb(v_risk))
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_demo_transaction_status_atomic(
    p_user_id uuid,
    p_reference_number text,
    p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_transaction public.transactions%ROWTYPE;
    v_risk public.transaction_risk%ROWTYPE;
    v_now timestamptz := now();
    v_severity varchar(20);
BEGIN
    IF p_user_id IS NULL
        OR p_reference_number IS NULL
        OR length(btrim(p_reference_number)) = 0
        OR length(p_reference_number) > 50
        OR p_status IS NULL
        OR p_status NOT IN ('Success', 'Pending', 'Failed', 'Flagged', 'Verification Required') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Transaction status request is invalid';
    END IF;

    SELECT t.* INTO v_transaction
    FROM public.transactions AS t
    JOIN public.accounts AS a ON a.id = t.account_id
    WHERE t.reference_number = p_reference_number
      AND a.user_id = p_user_id
    FOR UPDATE OF t;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSACTION_NOT_FOUND';
    END IF;

    IF v_transaction.status = p_status THEN
        RETURN jsonb_build_object('updated', false);
    END IF;
    IF NOT (
        (v_transaction.status = 'Verification Required' AND p_status IN ('Pending', 'Success', 'Failed', 'Flagged'))
        OR (v_transaction.status = 'Pending' AND p_status IN ('Success', 'Failed', 'Flagged'))
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_STATUS_TRANSITION';
    END IF;

    UPDATE public.transactions
    SET status = p_status
    WHERE id = v_transaction.id
    RETURNING * INTO v_transaction;

    IF p_status = 'Success' THEN
        INSERT INTO public.security_checks (
            user_id,
            check_type,
            result,
            risk_score,
            explanation,
            created_at
        )
        VALUES (
            p_user_id,
            'TRANSACTION',
            'VERIFICATION_COMPLETED',
            NULL,
            'Simulated transaction verification completed. No funds were transferred.',
            v_now
        );

        INSERT INTO public.security_activity (
            user_id,
            related_transaction_id,
            activity_type,
            description,
            created_at
        )
        VALUES (
            p_user_id,
            v_transaction.id,
            'VERIFICATION_COMPLETED',
            format('Simulated verification completed for transaction %s. No funds were transferred.', v_transaction.reference_number),
            v_now
        );
    ELSIF p_status = 'Flagged' THEN
        SELECT * INTO v_risk
        FROM public.transaction_risk
        WHERE transaction_id = v_transaction.id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TRANSACTION_RISK_NOT_FOUND';
        END IF;

        v_severity := CASE WHEN v_risk.risk_score >= 80 THEN 'Critical' ELSE 'High' END;
        INSERT INTO public.security_alerts (
            user_id,
            transaction_id,
            title,
            message,
            alert_type,
            severity,
            status,
            recommendation,
            created_at
        )
        VALUES (
            p_user_id,
            v_transaction.id,
            'High-risk demo transaction blocked',
            format('A simulated payment of ₹%s to %s was blocked by the demo risk assessment. No funds were transferred.', to_char(v_transaction.amount, 'FM999,999,999,990.00'), v_transaction.recipient_name),
            'HIGH_RISK_TRANSACTION',
            v_severity,
            'Unread',
            'Review the transaction risk details before trying another demo payment.',
            v_now
        );

        INSERT INTO public.security_checks (
            user_id,
            check_type,
            result,
            risk_score,
            explanation,
            created_at
        )
        VALUES (
            p_user_id,
            'TRANSACTION',
            'FLAGGED',
            v_risk.risk_score,
            'Simulated transaction was blocked by the local demo risk assessment.',
            v_now
        );

        INSERT INTO public.security_activity (
            user_id,
            related_transaction_id,
            activity_type,
            description,
            created_at
        )
        VALUES (
            p_user_id,
            v_transaction.id,
            'RISK_ALERT',
            format('High-risk simulated transaction %s was blocked. No funds were transferred.', v_transaction.reference_number),
            v_now
        );
    END IF;

    RETURN jsonb_build_object('updated', true);
END;
$function$;

REVOKE ALL ON TABLE public.securepay_demo_transaction_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_demo_transaction_atomic(
    uuid, text, uuid, uuid, text, text, numeric, text, text, integer, text,
    integer, integer, integer, integer, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_demo_transaction_atomic(
    uuid, text, uuid, uuid, text, text, numeric, text, text, integer, text,
    integer, integer, integer, integer, text, text
) TO service_role;
REVOKE ALL ON FUNCTION public.update_demo_transaction_status_atomic(uuid, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_demo_transaction_status_atomic(uuid, text, text)
    TO service_role;
