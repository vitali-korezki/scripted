 /*******************************************************************************
 * @license
 * Copyright (c) 2012 VMware, Inc. All Rights Reserved.
 * THIS FILE IS PROVIDED UNDER THE TERMS OF THE ECLIPSE PUBLIC LICENSE
 * ("AGREEMENT"). ANY USE, REPRODUCTION OR DISTRIBUTION OF THIS FILE
 * CONSTITUTES RECIPIENTS ACCEPTANCE OF THE AGREEMENT.
 * You can obtain a current copy of the Eclipse Public License from
 * http://www.opensource.org/licenses/eclipse-1.0.php
 *
 * Contributors:
 *     Andrew Eisenberg- initial API and implementation
 ******************************************************************************/
 
/*global require define scripted*/
/*jslint browser:true */

/**
 * Implements mark occurrences for an editor
 * Mark occurrences is lexically defined, so all instances of the selected word in the file will be marked
 */
define(['orion/textview/annotations'], function(mAnnotations) {

	var ANNOTATION_TYPE = mAnnotations.AnnotationType.ANNOTATION_MARK_OCCURRENCES;

	function isWordChar(char) {
		return (char >= 'a' && char <= 'z') ||
			(char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') ||
			char === '_' || char === '$'; 
	}
	
	/**
	 * Find word from selection
	 * A word is a contiguous block of alphanumerics or $ or _
	 * @return {word:String,start:number,end:number}
	 */
	function findSelectedWord(selstart, selend, buffer) {
		if (selstart < 0 || selend >= buffer.length || selstart > selend || !isWordChar(buffer[selstart])) {
			return null;
		}
		var i = selstart;
		while (i < selend) {
			if (!isWordChar(buffer[i])) {
				return null;
			}
			i++;
		}
		
		// at this point, we know there is a word selected, must find the start and the end
		var start, end;
		i = selstart;
		while (i >= 0) {
			if (!isWordChar(buffer[i])) {
				start = ++i;
				break;
			}
			i--;
		}
		
		if (!start && i === 0) {
			start = 0;
		}
		
		i = selend;
		while (i <= buffer.length) {
			if (!isWordChar(buffer[i])) {
				end = i;
				break;
			}
			i++;
		}
		
		if (!end && i === buffer.length) {
			end = buffer.length;
		}
		
		return {
			word: buffer.substring(start, end),
			start: start,
			end: end
		};
	}
	
	/**
	 * @param {String} buffer
	 * @param {String} toFind
	 * @return Array.<Number>
	 */
	function findMatches(buffer, toFind) {
		var current = 0;
		var matches = [];
		var match = buffer.indexOf(toFind, current);
		while (match >= 0) {
			matches.push(match);
			current = match + toFind.length;
			match = buffer.indexOf(toFind, current);
		}
		return matches;
	}
	
	
	var currentRequest;
	
	function SelectionMatcher() {
		// config options
		this.interval = 500; // inteval between caret changes and mark occurrence changes
		this.disable = false; // set to true if mark occurrences should be disabled
		this.retain = false;  // set to true if marks should be retained after caret moves away

		this.initOptions();
	}
	SelectionMatcher.prototype = {
		install : function(editor) {
			this.editor = editor;
			editor.getTextView().addEventListener("Selection", this);
		},
		uninstall : function() {
			if (this.editor) {
				this.editor.getTextView().removeEventListener("Selection", this);
				// remove all markers
				this.editor = null;
			}
		},
		handleEvent : function(evt) {
			if (this.disable) {
				return;
			}
			if (currentRequest) {
				clearTimeout(currentRequest);
			}
			var self = this;
			currentRequest = setTimeout(function() {
				self.markOccurrences(evt.newValue.start, evt.newValue.end);
			}, this.interval);
		},
		
		initOptions : function() {
			if (scripted.config && scripted.config.mark_occurrences) {
				var opts = scripted.config.mark_occurrences;
				if (typeof opts.interval === "number") {
					this.interval = opts.interval;
				}
				if (typeof opts.disable === "boolean") {
					this.disable = opts.disable;
				}
				if (typeof opts.retain === "boolean") {
					this.retain = opts.retain;
				}
			}
		},

		
		markOccurrences : function(selstart, selend) {
			/** @type AnnotationModel*/
			var annotationModel = this.editor.getAnnotationModel();
			
			// find new matches
			var buffer = this.editor.getText();
			var toFind = findSelectedWord(selstart, selend, buffer);
			// delete old markers
			if (toFind || !this.retain) {
				annotationModel.removeAnnotations(ANNOTATION_TYPE);
			}
			if (toFind) {
				var matches = findMatches(buffer, toFind.word);
				
				// add new markers
				var annotations = [];
				for (var i = 0; i < matches.length; i++) {
					annotations.push(mAnnotations.AnnotationType.createAnnotation(ANNOTATION_TYPE, matches[i], matches[i] + toFind.word.length));
				}
				annotationModel.replaceAnnotations(null, annotations);
			}
		}
	};
	
	// configure: persist when no selection. disable completely, settimeout
	return { SelectionMatcher : SelectionMatcher };
});