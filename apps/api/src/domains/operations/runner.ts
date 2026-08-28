import type { MediaJanitor } from '../media/janitor.js';
import type { OperationsRepository } from './repository.js';
import type { DiscordProvider, ExpoPushProvider, MessageClassifier } from './providers.js';

export class OperationsRunner {
  constructor(private readonly repository:OperationsRepository,private readonly expo:ExpoPushProvider,private readonly discord:DiscordProvider,private readonly classifier:MessageClassifier,private readonly mediaJanitor?:MediaJanitor) {}
  async runOnce(now=new Date(),limit=25) {
    const produced=await this.repository.produce(now,100); if(this.mediaJanitor)await this.mediaJanitor.runOnce(100);
    const items=await this.repository.claim(limit);let completed=0,failed=0;
    for(const item of items) {
      try {
        if(item.kind==='expo')await this.expo.send(item);else if(item.kind==='discord')await this.discord.send(item);else await this.classifier.classify(item);
        await this.repository.complete(item.id);completed++;
      } catch(cause) { await this.repository.fail(item.id,cause instanceof Error?cause.message:'unknown error');failed++; }
    }
    return {produced,claimed:items.length,completed,failed};
  }
}

