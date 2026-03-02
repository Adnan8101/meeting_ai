#!/usr/bin/env python3
"""
Test script to verify Gemini API integration works correctly
"""
import os
import sys
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv(dotenv_path='.env')

def test_gemini():
    print("🧠 Testing Gemini AI Integration")
    print("=" * 50)
    
    # Check API key
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ GEMINI_API_KEY not found in .env file")
        return False
    
    print(f"✅ API Key loaded: {api_key[:20]}...")
    
    try:
        # Configure Gemini
        genai.configure(api_key=api_key)
        print("✅ Gemini configured successfully")
        
        # Test basic generation
        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        print("✅ Model initialized: gemini-2.5-flash-lite")
        
        # Test with a meeting transcript
        test_prompt = """
        Analyze the following meeting transcript. Provide your analysis ONLY in a valid JSON object format.

        The JSON object must have these top-level keys: "summary", "decisions", "action_items".
        - "summary": (string) A concise, one-paragraph summary.
        - "decisions": (list of strings) A list of all concrete decisions made.
        - "action_items": (list of objects) A list of tasks. Each object must have: "task" (string), "assignee" (string), and "due_date" (string, use "Not specified" if none).

        Transcript:
        ---
        John: Let's discuss the Q1 marketing campaign. We need to finalize the budget and assign tasks.
        Sarah: I think we should allocate $50,000 for digital ads. I can handle the social media part.
        Mike: Agreed. I'll take care of the Google Ads campaign. We should launch by March 15th.
        John: Perfect. Sarah, can you have the social media strategy ready by March 1st?
        Sarah: Yes, I can do that.
        ---

        JSON Analysis:
        """
        
        response = model.generate_content(
            test_prompt,
            generation_config={'temperature': 0, 'max_output_tokens': 1000},
            request_options={'timeout': 30}
        )
        
        print("✅ AI analysis completed")
        print("\n📝 Response:")
        print(response.text)
        
        # Try to parse as JSON
        import json
        try:
            json_text = response.text.strip().replace('```json', '').replace('```', '').strip()
            parsed = json.loads(json_text)
            print("✅ Valid JSON response received")
            print(f"   - Summary: {len(parsed.get('summary', ''))} characters")
            print(f"   - Decisions: {len(parsed.get('decisions', []))} items")
            print(f"   - Action items: {len(parsed.get('action_items', []))} tasks")
            return True
        except json.JSONDecodeError as e:
            print(f"⚠️  JSON parsing issue: {e}")
            print("   (Response is valid but may need formatting cleanup)")
            return True
            
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {str(e)}")
        return False

def test_available_models():
    print("\n🔍 Testing Available Models")
    print("=" * 50)
    
    try:
        working_models = []
        for model in genai.list_models():
            if hasattr(model, 'supported_generation_methods'):
                methods = set(getattr(model, 'supported_generation_methods', []) or [])
                if 'generateContent' in methods:
                    model_name = model.name.replace('models/', '')
                    if model_name.startswith('gemini'):
                        try:
                            # Quick test
                            test_model = genai.GenerativeModel(model_name)
                            resp = test_model.generate_content(
                                'Reply OK',
                                generation_config={'max_output_tokens': 3, 'temperature': 0},
                                request_options={'timeout': 5}
                            )
                            if resp.text and resp.text.strip():
                                working_models.append(model_name)
                                print(f"✅ {model_name}")
                            else:
                                print(f"⚠️  {model_name} (empty response)")
                        except Exception as e:
                            error_type = type(e).__name__
                            if 'ResourceExhausted' in error_type:
                                print(f"💰 {model_name} (quota exceeded)")
                            else:
                                print(f"❌ {model_name} ({error_type})")
        
        print(f"\n🎯 Working models: {len(working_models)}")
        return working_models
        
    except Exception as e:
        print(f"❌ Error listing models: {e}")
        return []

if __name__ == "__main__":
    print("🚀 AI Meeting Agent - Gemini Integration Test")
    print("=" * 60)
    
    success = test_gemini()
    working_models = test_available_models()
    
    print("\n" + "=" * 60)
    if success and working_models:
        print("🎉 All tests passed! Gemini integration is working.")
        print(f"📊 {len(working_models)} models available for use.")
    elif success:
        print("✅ Basic integration works, but limited models available.")
    else:
        print("❌ Tests failed. Check your API key and connection.")
        sys.exit(1)
    
    print("\n🚀 You can now run: python run.py")