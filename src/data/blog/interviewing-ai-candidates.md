---
title: 'Lessons from interviewing 50 prospective Data Scientists in 9 days'
description: 'Fifty interviews in nine days, two years after sitting the same fellowship. What I learned from researchers transitioning into AI.'
pubDate: 2026-09-15
draft: false
---

I recently left my soulless job in fintech and found myself unemployed. Unexpectedly, an opportunity came up to help with the interview process for a fellowship: an intensive programme that helps STEM graduates and postdoc researchers transition from academia into a career in AI and data science. This was a unique situation -- having been on the same journey two years prior, I thought it'd be a valuable experience to sit on the opposite side of the table. Here's what I learned.

## The Interview

For context:

- The interview was the penultimate stage of the application process.
- The programme consists of two weeks of intense studying and a six week placement working on a client project.
- The first two stages, application and coding test, were designed to narrow down to the very best applicants.

Now it was my job to figure out: what drives and intrigues them, their background and whether their interest is real or rehearsed. Each call was half an hour long, though a few finished earlier and some went over. Typically the shorter ones didn't perform as well purely because they failed to provide enough depth (despite my best efforts to probe information out of them). On the flip side, the calls that overran were usually great. They showed more character and personality; combined with well thought out responses and questions at the end to cement themselves in my mind.

## What a CV doesn't tell you

Prior to each interview I would skim the candidate's CV; after repeating this countless times I started to calibrate and got a good sense of what makes a strong fellow. Now, it's impossible for me or anyone to remove biases, the best we can do is hope to remain impartial. But, whenever I would see a masters graduate or PhD student from an established university, I couldn't help but believe that their ML knowledge would be faultless.

This was more often than not the case, although it's worth mentioning that in a few rare cases, candidates with ML/DS related projects on their CV didn't have the faintest idea of how their model worked. This was a major red billboard. Usually I would let this boil down to nerves and I've been there (many times). That being said you should always be able to reason from first principles (especially if you have a maths background). I gave the candidates many opportunities to demonstrate their knowledge without interfering (aside from when I painfully had no other choice but to continue on).

It quickly became apparent that technically, the bar was very high. Over 90% of candidates had solid experience applying AI within their respective fields, whether it was neuroscience, astronomy, physics, maths or engineering.

## The boundary

So if everyone was technically great (with a few exceptions), how did I decide who didn't make the cut? Retrospectively, this wasn't a difficult decision. In fact, it was evident when subconsciously comparing good to excellent candidates. Ultimately, it boiled down to how effective their communication skills were, extra curricular activities and motivations for becoming a data scientist in the first place.

The candidates I had zero doubts about confidently conveyed the fundamental aspects of their work in an engaging manner, taking care to discuss only what was truly necessary, avoiding tangents. They showcased a level of introspection (with little to no prompting) including limitations, alternative approaches and improvements with respect to their projects. This was key and in my experience the successful jump from academia to industry is strongly dependent on how well you can present information to the right people.

In academia you typically optimise for a particular metric, develop innovative methods, conduct experiments and report novel findings. In industry, by contrast, there is a strong expectation to quantify the impact of your model within a business context. What can you do for the company? Will your "cutting edge" AI model cut costs? Increase revenue? Drive efficiency? Automate some mundane task to free up time elsewhere? This is what the majority of companies will care about, not a walkthrough of the backpropagation algorithm.

Aside from effective communication, the most successful interviewees displayed a proactive attitude whether it was being an active member within a community, solving problems of their own with AI/ML or in some cases even deploying a tool to live users. They didn't just claim to be interested in data science and AI -- in simple terms: they were about it. The success of the project itself is pretty irrelevant in my opinion; it's the willingness to experiment with technology and get your hands dirty that really stands out.

A data science career seems like the natural progression for many researchers disillusioned with the slow feedback loop in academia. The ability to clearly highlight their motivations for working in industry is another trait that distinguished candidates. Did they just apply to the fellowship on a whim? Did they have a preference for particular industries? Why did they want to leave academia now? What did they hope was different in a professional setting? There are no real right answers, but after listening to fifty people talk about their motives over two weeks, it starts to become clear whose reasoning is more intentional than not.

## The Two Chairs

Having sat in both interviewee and interviewer chairs, I now recognise how the perspectives of these roles differ. When interviewing I obsessed over ensuring I knew all the precise technical details of all my projects (in case I was quizzed on them in painstaking depth, which never happened). In reality, rationalising and communicating technical decisions you made in a clear and engaging manner leaves a much stronger impression. The technical bar was so high it didn't separate much.

In the candidate chair I obsessed over completing as many courses as possible: Andrew Ng's deep learning, elements of statistical learning, maths for machine learning, the list is endless. I genuinely believed I had to be a scholar in my knowledge of ML, DS, statistics, linear algebra and the never ending list of intertwined concepts. Yet, what stands out to an interviewer is a solid grasp of ML and DS fundamentals paired with a comprehensive understanding of the ins and outs of a particular project.

While working on courses signals initiative, the long list of certificates on a candidate's CV hardly left an impression. Learning by doing, weekend projects, tinkering around with a new technology for a niche use case -- undeniably stood out to me.

Something which is obvious to me, but maybe not to others, is this: an interview isn't just a one way street, it's a chance to build rapport with the person on the other side. About a third of all candidates had no questions -- zero, nada, and the call ended abruptly after that. I view the Q&A part as a time for any tensions to disperse and a chance for the interviewee to flip the script and ask their own thought provoking questions to see if they resonate with the answer. Forget whether they're the right person for the fellowship; is the fellowship the right opportunity for them? I found that the more personable candidates really cemented their mark during the final moments of our conversations.

Of course everyone has to sneak in LLMs somehow into the conversation in the hopes it signals currency. What many fail to realise is bringing up LLMs without a genuine use case is worthless. I've been guilty in the past of attempting to fit in whatever technique was trendiest, fully aware now that it always does more harm than good.

## Final thoughts

Overall, the interview guide was well structured and the questions were well curated, aimed at figuring out which candidates had put serious effort and thought into leaving academia. The missing piece was arguably gauging the role of AI in their daily workflows. I couldn't help but go off-script at times, curious to learn about the effect of AI on their day to day studies, research, development practices etc. I didn't get much back in return, just the usual speed gains and productivity boost most people swear by.

It's incredibly easy for me to sit here on my high horse and provide critique and decide who's good enough and who isn't. So the question arises: would I have passed my own bar? Could I have explained XGBoost cold? The answer is yes, I believe I could. Around the time I interviewed for the fellowship, GPT was the dominant LLM in the arena and its capabilities were a small fraction of what LLMs can now do. I can recall two years ago just about trusting chatGPT to fix isolated Python functions here and there (by painfully copying and pasting numerous times). Yet, I would still turn to LLMs, iteratively refining my theoretical knowledge and solidifying my main talking points.

So if today's candidates have access to superior tools, why isn't deep knowledge and articulation better? It's hard to pinpoint, but my theory is that outsourcing heavily to AI makes us lazy and inevitably leads to cognitive debt [^1]. In the long run we're left with a lack of real understanding and broken mental models of how things work. Everyone is responsible for their own learning but there's no hiding the unrelenting fixation with shipping at the speed of light. Maybe we no longer put enough emphasis on deciding what to build or how to do it. Instead, we ever more trustingly press accept all and glare at the result, as the euphoric feeling of creating something ourselves evaporates.

Maybe we focus on mastering the technical too much and not enough on conveying the impact and consequence of our work -- the things that should matter most.


[^1]: Kosmyna et al., [*Your Brain on ChatGPT: Accumulation of Cognitive Debt when Using an AI Assistant for Essay Writing Task*](https://arxiv.org/abs/2506.08872), MIT Media Lab, arXiv preprint 2506.08872, 2025. Note: a preprint, not peer reviewed.
