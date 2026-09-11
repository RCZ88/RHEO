# Error 1:
## source
block:the-parser-s-anatomy-b2
table
{
  "id": "the-parser-s-anatomy-b2",
  "type": "table",
  "columns": [
    {
      "title": "Feature",
      "field": "c0"
    },
    {
      "title": "Status",
      "field": "c1"
    }
  ],
  "rows": [
    {
      "c0": "Prose",
      "c1": "Active"
    },
    {
      "c0": "Table",
      "c1": "Active"
    },
    {
      "c0": "Mermaid",
      "c1": "Active"
    }
  ]
}

## error description: 
Feature  So what that thing just load is just a bunch of text or stack on top of each other with a panel on the background  So there's no table whatsoever. There's no proper anything whatsoever, right?  It just has this weird looking multiple stack text that has multiple text on it and I can't read but I just pasted those under there so

# Error 2:
## Source
block:the-parser-s-anatomy-b3
mermaid
{
  "id": "the-parser-s-anatomy-b3",
  "type": "mermaid",
  "src": "flowchart TD\n    A[\"Start\"] --> B[\"Parse Frontmatter\"]\n    B --> C{\"Valid YAML?\"}\n    C -->|\"Yes\"| D[\"Parse Nodes\"]\n    C -->|\"No\"| E[\"Throw Error\"]\n    D --> F[\"Render UI\"]"
}

## error description:  
This one, it's just stop on the loading right there's the cart and there's the loading thing the loading spin  Circle thing doesn't move. It's just stop there and doesn't load the mermaid properly  And if I were to see there's no mermaid error whatsoever in the logs nor the application itself  So it's just not loading in properly. I need you to fix those two


error 3:
## source
block:data-flow-and-visualization-b2
chart
{
  "id": "data-flow-and-visualization-b2",
  "type": "chart",
  "spec": "{\n  \"$schema\": \"https://vega.github.io/schema/vega-lite/v5.json\",\n  \"data\": {\n    \"values\": [\n      {\"block\": \"Prose\", \"time_ms\": 12},\n      {\"block\": \"Table\", \"time_ms\": 18},\n      {\"block\": \"Mermaid\", \"time_ms\": 45},\n      {\"block\": \"Chart\", \"time_ms\": 32}\n    ]\n  },\n  \"mark\": {\"type\": \"bar\", \"cornerRadiusEnd\": 4},\n  \"encoding\": {\n    \"x\": {\"field\": \"block\", \"type\": \"nominal\", \"axis\": {\"labelAngle\": 0}},\n    \"y\": {\"field\": \"time_ms\", \"type\": \"quantitative\", \"title\": \"Parse Time (ms)\"}\n  },\n  \"width\": 400,\n  \"height\": 200\n}",
  "parsed": {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "data": {
      "values": [
        {
          "block": "Prose",
          "time_ms": 12
        },
        {
          "block": "Table",
          "time_ms": 18
        },
        {
          "block": "Mermaid",
          "time_ms": 45
        },
        {
          "block": "Chart",
          "time_ms": 32
        }
      ]
    },
    "mark": {
      "type": "bar",
      "cornerRadiusEnd": 4
    },
    "encoding": {
      "x": {
        "field": "block",
        "type": "nominal",
        "axis": {
          "labelAngle": 0
        }
      },
      "y": {
        "field": "time_ms",
        "type": "quantitative",
        "title": "Parse Time (ms)"
      }
    },
    "width": 400,
    "height": 200
  },
  "caption": "Parser Execution Time by Block Type"
}

## error description:  
It just gives this error, there's like this parser execution type by block type, the text  of the, I mean, I think the title there works properly, but the chart itself or whatever  visualization itself doesn't rig and it has this error on it:
Failed to load chart renderer: Failed to fetch dynamically imported module: http://localhost:61996/assets/embed.B1g2VSwi.js
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": {
    "values": [
      {"block": "Prose", "time_ms": 12},
      {"block": "Table", "time_ms": 18},
      {"block": "Mermaid", "time_ms": 45},
      {"block": "Chart", "time_ms": 32}
    ]
  },
  "mark": {"type": "bar", "cornerRadiusEnd": 4},
  "encoding": {
    "x": {"field": "block", "type": "nominal", "axis": {"labelAngle": 0}},
    "y": {"field": "time_ms", "type": "quantitative", "title": "Parse Time (ms)"}
  },
  "width": 400,
  "height": 200
}


# error 4:
## source
block:data-flow-and-visualization-b3
finchart
{
  "id": "data-flow-and-visualization-b3",
  "type": "finchart",
  "spec": "{\n  \"$schema\": \"https://vega.github.io/schema/vega-lite/v5.json\",\n  \"data\": {\n    \"values\": [\n      {\"quarter\": \"Q1\", \"revenue\": 100, \"cost\": 40},\n      {\"quarter\": \"Q2\", \"revenue\": 120, \"cost\": 45},\n      {\"quarter\": \"Q3\", \"revenue\": 150, \"cost\": 50}\n    ]\n  },\n  \"mark\": \"line\",\n  \"encoding\": {\n    \"x\": {\"field\": \"quarter\", \"type\": \"nominal\"},\n    \"y\": {\"field\": \"revenue\", \"type\": \"quantitative\"},\n    \"color\": {\"field\": \"metric\", \"type\": \"nominal\"}\n  }\n}",
  "parsed": {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "data": {
      "values": [
        {
          "quarter": "Q1",
          "revenue": 100,
          "cost": 40
        },
        {
          "quarter": "Q2",
          "revenue": 120,
          "cost": 45
        },
        {
          "quarter": "Q3",
          "revenue": 150,
          "cost": 50
        }
      ]
    },
    "mark": "line",
    "encoding": {
      "x": {
        "field": "quarter",
        "type": "nominal"
      },
      "y": {
        "field": "revenue",
        "type": "quantitative"
      },
      "color": {
        "field": "metric",
        "type": "nominal"
      }
    }
  },
  "caption": "Financial Impact of Parser Optimization"
}

## error description:  
You got the same error here, it's showing the title of financial impact parser optimization,  but it doesn't load the chart properly, it just loads the error, which I will include the error here:
Invalid chart data: No data series found
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": {
    "values": [
      {"quarter": "Q1", "revenue": 100, "cost": 40},
      {"quarter": "Q2", "revenue": 120, "cost": 45},
      {"quarter": "Q3", "revenue": 150, "cost": 50}
    ]
  },
  "mark": "line",
  "encoding": {
    "x": {"field": "quarter", "type": "nominal"},
    "y": {"field": "revenue", "type": "quantitative"},
    "color": {"field": "metric", "type": "nominal"}
  }
}


# ERROR 5:
## source:
{
  "id": "data-flow-and-visualization-b4",
  "type": "flow",
  "variant": "sankey",
  "spec": "- Input Text -> Frontmatter Parser : 10\n- Input Text -> Node Parser : 90\n- Node Parser -> Block Router : 90\n- Block Router -> Visual Renderer : 40\n- Block Router -> Text Renderer : 50\ncaption: How text flows through the parsing pipeline",
  "edges": [
    {
      "from": "Input Text",
      "to": "Frontmatter Parser",
      "value": 10
    },
    {
      "from": "Input Text",
      "to": "Node Parser",
      "value": 90
    },
    {
      "from": "Node Parser",
      "to": "Block Router",
      "value": 90
    },
    {
      "from": "Block Router",
      "to": "Visual Renderer",
      "value": 40
    },
    {
      "from": "Block Router",
      "to": "Text Renderer",
      "value": 50
    }
  ],
  "caption": "sankey"
}

## error description: 
same error where the only things loading is the title, adn the errori s not on a red text, but just a normal text (the two previously is a red error). the error for this is:
⚠ Diagram could not render
Failed to fetch dynamically imported module: http://localhost:61996/assets/sankeyDiagram-HTMAVEWB.DlR-fiZ1.js
Show diagram source
- Input Text -> Frontmatter Parser : 10
- Input Text -> Node Parser : 90
- Node Parser -> Block Router : 90
- Block Router -> Visual Renderer : 40
- Block Router -> Text Renderer : 50
caption: How text flows through the parsing pipeline

# Error 6:
## SOURCE:
{
  "id": "data-flow-and-visualization-b5",
  "type": "table",
  "columns": [
    {
      "title": "Directive",
      "field": "directive_name"
    },
    {
      "title": "Complexity",
      "field": "complexity"
    },
    {
      "title": "Status",
      "field": "status"
    }
  ],
  "rows": [
    {
      "directive_name": "chart",
      "complexity": "High",
      "status": "Verified"
    },
    {
      "directive_name": "figure",
      "complexity": "Medium",
      "status": "Verified"
    },
    {
      "directive_name": "flow",
      "complexity": "Low",
      "status": "Verified"
    }
  ]
}

## error description: 
a 5 line text wit htext stacked on to p of one another making a mess. no error logs whatsoever tho.

# error 7:
## source:
block:advanced-rendering-and-interactivity-b2
code
{
  "id": "advanced-rendering-and-interactivity-b2",
  "type": "code",
  "lang": "python",
  "src": "import sys\n\ndef test_parser_features():\n    features = [\"code\", \"table\", \"figure\", \"illustration\", \"callout\", \"layer\", \"quiz\"]\n    parsed_count = 0\n    for feature in features:\n        parsed_count += 1\n        print(f\"Successfully parsed: {feature}\")\n    \n    print(f\"Total features verified: {parsed_count}\")\n    return parsed_count\n\nif __name__ == \"__main__\":\n    test_parser_features()",
  "runnable": false
}

## error description:
it just loads a pythong thing with non python code ((html like )) inside of it:

python
Run
Copy
400">"text-emerald-400">import sys

400">"text-emerald-400">def test_parser_features():
    features = [400">"code", 400">"table", 400">"figure", 400">"illustration", 400">"callout", 400">"layer", 400">"quiz"]
    parsed_count = 0
    400">"text-emerald-400">for feature 400">"text-emerald-400">in features:
        parsed_count += 1
        400">"text-emerald-400">print(f400">"Successfully parsed: {feature}")
    
    400">"text-emerald-400">print(f400">"Total features verified: {parsed_count}")
    400">"text-emerald-400">return parsed_count

400">"text-emerald-400">if __name__ == 400">"__main__":
    test_parser_features()

# error 8:

## source:
{
  "id": "advanced-rendering-and-interactivity-b4",
  "type": "widget",
  "kind": "html",
  "html": "<div style=\"padding: 20px; background: #1e293b; color: #f8fafc; border-radius: 8px; text-align: center;\">\n  <h3>Interactive HTML Widget</h3>\n  <p>This block tests self-contained HTML/CSS/JS rendering.</p>\n  <button onclick=\"this.innerText='Clicked!'\" style=\"padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer;\">Test Interaction</button>\n</div>"
}

##error description:
its showing an empty visulizaiton, but the full scree nadn like the heading that shows its a widget shows up proeprly. full scree nbutton works.

# error 9:

ILLUSTRATION IS NOT PARSED PROPERLY IDIOT. I HAVE ALREADY MENTIOEND THE FEATURE WHERE IT F TEHRE  ANILLUSTRATION IT SHOULD SHOW THE LIST OF ILLUSTRATION ON A UI THAT CAN BE OPEND FROM A BUTTON. EACH INDIVIDUAL ILLUSTRATION SHOULD HAVE THE UI THAT SHOWS THE PROMPT AND THE COPY BUTTON, AND THEN A PLACE FOR THE USER TO INPUT THE IMAGE.

SOURCE: :::illustration {"prompt":"Generate one standalone 16:9 horizontal Chinese article illustration. Visual DNA: Pure white background. Minimalist black hand-drawn line art. Slightly wobbly pen lines. Lots of empty white space. Sparse red/orange/blue handwritten Chinese annotations. Clean absurd product-sketch feeling. No gradients, no shadows, no paper texture. Recurring IP character: 小黑, a small solid-black absurd creature with white dot eyes, tiny thin legs, blank serious expression. 小黑 must perform the core conceptual action, not decorate the scene. Theme: Testing a parser. Structure type: Workflow. Core idea: 小黑 feeds markdown blocks into a sorting machine that outputs structured nodes. Composition: 小黑 standing at a conveyor belt, dropping paper blocks with symbols into a hopper. Orange arrows show the flow into a neat stack of compiled nodes on the right. Suggested elements: conveyor belt / hopper / paper blocks / compiled nodes. Chinese handwritten labels: 解析器 / 语法树 / 渲染 / 测试. Color use: Black for main line art. Orange for flow arrows. Red for warnings.","concept":"The parser ingests raw markdown and compiles it into structured learning nodes"}
:::