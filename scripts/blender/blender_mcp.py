"""Run a repository Blender script through a real MCP stdio session.

uv run --with mcp python scripts/blender/blender_mcp.py scripts/blender/build_tiger.py
Requires the Blender addon running in a GUI session on localhost:9876.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main(args):
    env = {**os.environ,"PYTHONIOENCODING":"utf-8"}
    server = StdioServerParameters(command="uvx",args=["mcp-for-blender"],env=env)
    async with stdio_client(server) as (reader,writer):
        async with ClientSession(reader,writer) as session:
            await session.initialize()
            if args.script:
                path = str(Path(args.script).resolve())
                code = f"exec(compile(open({path!r},encoding='utf-8').read(),{path!r},'exec'),{{'__file__':{path!r},'PREVIEW_ONLY':{args.preview!r}}})"
                result = await session.call_tool("execute_blender_code",{"code":code,"user_prompt":args.prompt})
            else:
                result = await session.call_tool("get_scene_info",{"user_prompt":args.prompt})
            payload = result.model_dump(mode="json")
            print(json.dumps(payload,indent=2))
            failed = getattr(result,"isError",getattr(result,"is_error",False))
            # Some server tools encode Blender exceptions as text instead of isError.
            texts = [getattr(c,"text","") for c in result.content]
            if failed or any(t.startswith("Error executing") for t in texts):
                raise RuntimeError("Blender MCP failed; see tool response above")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("script",nargs="?")
    parser.add_argument("--preview",action="store_true")
    parser.add_argument("--prompt",default="Create a four-direction walking tiger sprite demo with an animated tail and document the workflow in the repository.")
    asyncio.run(main(parser.parse_args()))
