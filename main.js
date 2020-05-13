(function() {

    // Create ink story from the content using inkjs
    var story;
    
	var storyContainer = document.querySelector('#story');
    var outerScrollContainer = document.querySelector('.outerContainer');
 	var delayAmount = 0.0;
 	
	outerScrollContainer.addEventListener("click", function(event) {
		if (story.variablesState["vnmode"]) continueStory();
	});

	fetch('story.json')
	.then(function(response){
		return response.text();
	})
	.then(function(storyContent){
		story = new inkjs.Story(storyContent);
	
		// Kick off the start of the story!
		continueStory(true);
	});

    // Main story processing function. Each time this is called it generates
    // all the next content up as far as the next set of choices.
    function continueStory(firstTime) {

        var paragraphIndex = 0;
        var delay = 0.0;
        
        // Don't over-scroll past new content
        var previousBottomEdge = firstTime ? 0 : contentBottomEdgeY();

        // Generate story text - loop through available content
        while (story.canContinue) {
            // Get ink to generate the next paragraph
            var paragraphText = story.Continue();
            var tags = story.currentTags;
            
            // Any special tags included with this line
            var customClasses = [];
            for(var i=0; i<tags.length; i++) 
            {
                var tag = tags[i];

                // Detect tags of the form "X: Y". Currently used for IMAGE and CLASS but could be
                // customised to be used for other things too.
                var splitTag = splitPropertyTag(tag);
				if(splitTag)
				{
					console.log(splitTag);
					switch(splitTag.name)
					{				
						case "image": 
							var imageElement = document.createElement('img');
							imageElement.src = splitTag.val;
							console.log(imageElement);
							storyContainer.appendChild(imageElement);

							showAfter(delay, imageElement);
							delay += delayAmount;
							break;
						case "class":
							customClasses.push(splitTag.val);
							break;		
						case "clear":
						case "restart":
							removeAll(".header *");
							removeAll("p");
							previousBottomEdge = 0;
							if( tag == "restart" ) {
								restart();
								return;
							}
							break;
						case "theme": 
							document.body.classList.toggle(splitTag.val);
							break;														
						case "+theme": 
							document.body.classList.add(splitTag.val);
							break;
						case "-theme": 
							document.body.classList.remove(splitTag.val);
							break;						
						case "title":
							var header = document.querySelector('.header');
							var title = document.createElement('h1');
							title.innerHTML = splitTag.val;
							header.appendChild(title);
							break;						
						case "subtitle":
							var header = document.querySelector('.header');
							var byline = document.createElement('h2');
							byline.innerHTML = splitTag.val;
							header.appendChild(byline);
							break;
						default:
// 							vars[splitTag.key] = splitTag.val;
// 							console.log("Unhandled tag: " + splitTag.name);
							customClasses.push(splitTag.name);
					}
				}
            }

            // Create paragraph element (initially hidden)
            var paragraphElement = document.createElement('p');
            paragraphElement.innerHTML = paragraphText;
            storyContainer.appendChild(paragraphElement);
            
            // Add any custom classes derived from ink tags
            for(var i=0; i<customClasses.length; i++)
                paragraphElement.classList.add(customClasses[i]);

            // Fade in paragraph after a short delay
            showAfter(delay, paragraphElement);
            delay += delayAmount;
            
              
			if (story.variablesState["vnmode"])
			{
				break;
			}
        }

        // Create HTML choices from ink choices
        story.currentChoices.forEach(function(choice) {

            // Create paragraph with anchor element
            var choiceParagraphElement = document.createElement('p');
            choiceParagraphElement.classList.add("choice");
            choiceParagraphElement.innerHTML = `<a href='#'>${choice.text}</a>`
            storyContainer.appendChild(choiceParagraphElement);

            // Fade choice in after a short delay
            showAfter(delay, choiceParagraphElement);
            delay += delayAmount;

            // Click on choice
            var choiceAnchorEl = choiceParagraphElement.querySelectorAll("a")[0];
            choiceAnchorEl.addEventListener("click", function(event) {

                // Don't follow <a> link
                event.preventDefault();

                // Remove all existing choices
                removeAll("p.choice");

                // Tell the story where to go next
                story.ChooseChoiceIndex(choice.index);
				outerScrollContainer.scrollTo(0,1);
                // Aaand loop
                continueStory();
            });
        });

        // Extend height to fit
        // We do this manually so that removing elements and creating new ones doesn't
        // cause the height (and therefore scroll) to jump backwards temporarily.
        storyContainer.style.height = contentBottomEdgeY()+"px";

        if( !firstTime )
            scrollDown(previousBottomEdge);
    }

    function restart() {
        story.ResetState();

        continueStory(true);

        outerScrollContainer.scrollTo(0, 0);
    }

    // -----------------------------------
    // Various Helper functions
    // -----------------------------------

    // Fades in an element after a specified delay
    function showAfter(delay, el) {
        el.classList.add("hide");
        setTimeout(function() { el.classList.remove("hide") }, delay);
    }

    // Scrolls the page down, but no further than the bottom edge of what you could
    // see previously, so it doesn't go too far.
    function scrollDown(previousBottomEdge) {

        // Line up top of screen with the bottom of where the previous content ended
        var target = previousBottomEdge;
        
        // Can't go further than the very bottom of the page
        var limit = outerScrollContainer.scrollHeight - outerScrollContainer.clientHeight;
        if( target > limit ) target = limit;

        var start = outerScrollContainer.scrollTop;

        var dist = target - start;
        var duration = 300 + 300*dist/100;
        var startTime = null;
        function step(time) {
            if( startTime == null ) startTime = time;
            var t = (time-startTime) / duration;
            var lerp = 3*t*t - 2*t*t*t; // ease in/out
            outerScrollContainer.scrollTo(0, (1.0-lerp)*start + lerp*target);
            if( t < 1 ) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    // The Y coordinate of the bottom end of all the story content, used
    // for growing the container, and deciding how far to scroll.
    function contentBottomEdgeY() {
        var bottomElement = storyContainer.lastElementChild;
        return bottomElement ? bottomElement.offsetTop + bottomElement.offsetHeight : 0;
    }

    // Remove all elements that match the given selector. Used for removing choices after
    // you've picked one, as well as for the CLEAR and RESTART tags.
    function removeAll(selector)
    {
        var allElements = storyContainer.querySelectorAll(selector);
        for(var i=0; i<allElements.length; i++) {
            var el = allElements[i];
            el.parentNode.removeChild(el);
        }
    }

    // Helper for parsing out tags of the form:
    //  # NAME: value
    // e.g. IMAGE: source path
    function splitPropertyTag(tag) {
        var propertySplitIdx = tag.indexOf(":");

        if (propertySplitIdx == -1)
        {
			return {
				name: tag.trim().toLowerCase(),
			};        
        }
		else
		{		
			return {
				name: tag.substr(0, propertySplitIdx).trim(),
				val: tag.substr(propertySplitIdx+1).trim()
			};
		}
    }

})();