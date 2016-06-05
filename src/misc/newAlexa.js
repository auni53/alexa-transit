class AlexaSkill {
  constructor(appId) {
    this._appId = appId;
  }

  execute(event, context) {
    try {
      console.log(`session applicationId: ${event.session.application.applicationId}`);

      // Validate that this request originated from authorized source.
      if (this._appId && event.session.application.applicationId !== this._appId) {
        console.log(`The applicationIds don't match : ${event.session.application.applicationId} and ${this._appId}`);
        throw "Invalid applicationId";
      }

      if (!event.session.attributes) {
        event.session.attributes = {};
      }

      if (event.session.new) {
        this.eventHandlers.onSessionStarted(event.request, event.session);
      }

      // Route the request to the proper handler which may have been overriden.
      const requestHandler = this.requestHandlers[event.request.type];
      requestHandler.call(this, event, context, new Response(context, event.session));
    } catch (e) {
      console.log(`Unexpected exception ${e}`);
      context.fail(e);
    }
  }
}

AlexaSkill.speechOutputType = {
  PLAIN_TEXT: 'PlainText',
  SSML: 'SSML'
}

AlexaSkill.prototype.requestHandlers = {
  LaunchRequest(event, context, response) {
    this.eventHandlers.onLaunch.call(this, event.request, event.session, response);
  },

  IntentRequest(event, context, response) {
    this.eventHandlers.onIntent.call(this, event.request, event.session, response);
  },

  SessionEndedRequest(event, context) {
    this.eventHandlers.onSessionEnded(event.request, event.session);
    context.succeed();
  }
};

/**
 * Override any of the eventHandlers as needed
 */
AlexaSkill.prototype.eventHandlers = {
  /**
   * Called when the session starts.
   * Subclasses could have overriden this function to open any necessary resources.
   */
  onSessionStarted(sessionStartedRequest, session) {
  },

  /**
   * Called when the user invokes the skill without specifying what they want.
   * The subclass must override this function and provide feedback to the user.
   */
  onLaunch(launchRequest, session, response) {
    throw "onLaunch should be overriden by subclass";
  },

  /**
   * Called when the user specifies an intent.
   */
  onIntent(intentRequest, session, response) {
    const intent = intentRequest.intent, intentName = intentRequest.intent.name, intentHandler = this.intentHandlers[intentName];
    if (intentHandler) {
      console.log(`dispatch intent = ${intentName}`);
      intentHandler.call(this, intent, session, response);
    } else {
      throw `Unsupported intent = ${intentName}`;
    }
  },

  /**
   * Called when the user ends the session.
   * Subclasses could have overriden this function to close any open resources.
   */
  onSessionEnded(sessionEndedRequest, session) {
  }
};

/**
 * Subclasses should override the intentHandlers with the functions to handle specific intents.
 */
AlexaSkill.prototype.intentHandlers = {};

var Response = function (context, session) {
  this._context = context;
  this._session = session;
};

function createSpeechObject(optionsParam) {
  if (optionsParam && optionsParam.type === 'SSML') {
    return {
      type: optionsParam.type,
      ssml: optionsParam.speech
    };
  } else {
    return {
      type: optionsParam.type || 'PlainText',
      text: optionsParam.speech || optionsParam
    }
  }
}

Response.prototype = ((() => {
  const buildSpeechletResponse = options => {
    const alexaResponse = {
      outputSpeech: createSpeechObject(options.output),
      shouldEndSession: options.shouldEndSession
    };
    if (options.reprompt) {
      alexaResponse.reprompt = {
        outputSpeech: createSpeechObject(options.reprompt)
      };
    }
    if (options.cardTitle && options.cardContent) {
      alexaResponse.card = {
        type: "Simple",
        title: options.cardTitle,
        content: options.cardContent
      };
    }
    const returnResult = {
        version: '1.0',
        response: alexaResponse
    };
    if (options.session && options.session.attributes) {
      returnResult.sessionAttributes = options.session.attributes;
    }
    return returnResult;
  };

  return {
    tell(speechOutput) {
      this._context.succeed(buildSpeechletResponse({
        session: this._session,
        output: speechOutput,
        shouldEndSession: true
      }));
    },
    tellWithCard(speechOutput, cardTitle, cardContent) {
      this._context.succeed(buildSpeechletResponse({
        session: this._session,
        output: speechOutput,
        cardTitle,
        cardContent,
        shouldEndSession: true
      }));
    },
    ask(speechOutput, repromptSpeech) {
      this._context.succeed(buildSpeechletResponse({
        session: this._session,
        output: speechOutput,
        reprompt: repromptSpeech,
        shouldEndSession: false
      }));
    },
    askWithCard(speechOutput, repromptSpeech, cardTitle, cardContent) {
      this._context.succeed(buildSpeechletResponse({
        session: this._session,
        output: speechOutput,
        reprompt: repromptSpeech,
        cardTitle,
        cardContent,
        shouldEndSession: false
      }));
    }
  };
}))();

export default AlexaSkill;
