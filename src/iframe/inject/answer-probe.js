

export function probeAnswerState(site) {
  const sels = site?.stopButtonSelectors;
  const doneSels = site?.doneButtonSelectors;
  const hasStop = Array.isArray(sels) && sels.length > 0;
  const hasDone = Array.isArray(doneSels) && doneSels.length > 0;
  if (!hasStop && !hasDone) {
    return { detectable: false, generating: false, done: false };
  }
  
  if (hasDone) {
    for (const sel of doneSels) {
      try {
        if (document.querySelector(sel)) {
          return { detectable: true, generating: false, done: true };
        }
      } catch (_e) {
        
      }
    }
  }
  
  if (hasStop) {
    for (const sel of sels) {
      try {
        if (document.querySelector(sel)) {
          return { detectable: true, generating: true, done: false };
        }
      } catch (_e) {
        
      }
    }
  }
  return { detectable: true, generating: false, done: false };
}
