import { useCallback, useEffect, useRef, useState } from 'react';
import { getTrainStatus } from '../api/client';
import type { TrainResponse } from '../types';

const POLL_INTERVAL_MS = 2000;

export function useTrainingJob() {
  const [job, setJob] = useState<TrainResponse | null>(null);
  const [polling, setPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPolling(false);
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      setPolling(true);
      intervalRef.current = setInterval(async () => {
        try {
          const status = await getTrainStatus(jobId);
          setJob(status);
          if (status.status === 'completed' || status.status === 'failed') {
            stopPolling();
          }
        } catch {
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { job, setJob, polling, startPolling, stopPolling };
}
