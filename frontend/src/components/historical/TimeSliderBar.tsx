import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { GhostOutlineButton } from '../ui/GhostOutlineButton';

export const TimeSliderBar: React.FC = () => {
  const {
    replayTimeline,
    currentReplayStepIndex,
    setCurrentReplayStepIndex,
    isPlayingReplay,
    setIsPlayingReplay,
    replaySpeed,
    setReplaySpeed,
  } = useStore();

  const timeline = replayTimeline?.timeline || [];

  useEffect(() => {
    let interval: any = null;
    if (isPlayingReplay && timeline.length > 0) {
      const stepDuration = 2000 / replaySpeed;
      interval = setInterval(() => {
        setCurrentReplayStepIndex(
          currentReplayStepIndex >= timeline.length - 1 ? 0 : currentReplayStepIndex + 1
        );
      }, stepDuration);
    }
    return () => clearInterval(interval);
  }, [isPlayingReplay, currentReplayStepIndex, timeline.length, replaySpeed, setCurrentReplayStepIndex]);

  if (!replayTimeline || timeline.length === 0) return null;

  const currentStep = timeline[currentReplayStepIndex];

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] w-[90%] max-w-[850px]">
      <div className="bg-console-charcoal/95 backdrop-blur-md border border-wire-gray rounded-[12px] p-4 flex flex-col gap-3 shadow-none">
        <div className="flex items-center justify-between text-[12px] font-mono border-b border-wire-gray/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-mute-gray">INCIDENT TIMELINE REPLAY:</span>
            <span className="font-bold text-bone-white">{replayTimeline.name}</span>
          </div>
          <div className="flex items-center gap-2 text-off-white">
            <span>Timestamp:</span>
            <span className="text-bone-white font-bold">{currentStep?.timestamp}</span>
          </div>
        </div>

        <div className="relative w-full py-2">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-recess-black -translate-y-1/2 rounded-[2px] border border-wire-gray/40" />

          <div
            className="absolute top-1/2 left-0 h-1 bg-bone-white -translate-y-1/2 rounded-[2px] transition-all duration-300"
            style={{
              width: `${(currentReplayStepIndex / Math.max(1, timeline.length - 1)) * 100}%`,
            }}
          />

          <div className="relative flex justify-between items-center z-10">
            {timeline.map((step, idx) => {
              const isSelected = idx === currentReplayStepIndex;
              const isPast = idx <= currentReplayStepIndex;
              return (
                <button
                  key={step.step_label}
                  onClick={() => setCurrentReplayStepIndex(idx)}
                  className="flex flex-col items-center gap-1 group"
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full border transition-all flex items-center justify-center ${
                      isSelected
                        ? 'bg-bone-white border-bone-white ring-2 ring-wire-gray'
                        : isPast
                        ? 'bg-bone-white border-bone-white'
                        : 'bg-recess-black border-wire-gray group-hover:border-mute-gray'
                    }`}
                  />
                  <span
                    className={`text-[11px] font-mono font-medium transition-colors ${
                      isSelected
                        ? 'text-bone-white font-bold'
                        : isPast
                        ? 'text-off-white'
                        : 'text-mute-gray'
                    }`}
                  >
                    {step.step_label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-wire-gray/40 text-[12px]">
          <div className="flex items-center gap-2">
            <GhostOutlineButton
              onClick={() => setIsPlayingReplay(!isPlayingReplay)}
              icon={isPlayingReplay ? <Pause className="w-3.5 h-3.5 stroke-[1.5]" /> : <Play className="w-3.5 h-3.5 stroke-[1.5]" />}
            >
              {isPlayingReplay ? 'Pause' : 'Play Replay'}
            </GhostOutlineButton>

            <GhostOutlineButton
              onClick={() => {
                setIsPlayingReplay(false);
                setCurrentReplayStepIndex(0);
              }}
              icon={<RotateCcw className="w-3.5 h-3.5 stroke-[1.5]" />}
            >
              Reset
            </GhostOutlineButton>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-mute-gray mr-1">SPEED:</span>
            {[1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => setReplaySpeed(speed)}
                className={`px-2 py-0.5 rounded-[4px] border ${
                  replaySpeed === speed
                    ? 'bg-bone-white text-nav-ink border-bone-white font-bold'
                    : 'bg-recess-black text-mute-gray border-wire-gray hover:text-bone-white'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};