from setuptools import setup, find_packages

setup(
    name="nebula-bgp",
    version="2.0.0",
    author="mehdisec",
    description="Interactive 3D & 2D Global BGP Routing Topology & WHOIS Radar",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/mehdisec/Nebula-BGP-3D-MAP",
    packages=find_packages(),
    include_package_data=True,
    package_data={
        "backend": [
            "frontend/*",
            "frontend/**/*",
            "frontend/**/**/*",
        ]
    },
    install_requires=[
        "fastapi>=0.104.0",
        "uvicorn[standard]>=0.23.0",
        "httpx>=0.25.0",
        "pydantic>=2.4.0",
        "jinja2>=3.1.2",
        "python-multipart>=0.0.6",
    ],
    entry_points={
        "console_scripts": [
            "nebula-bgp=backend.main:serve_cli",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: System :: Networking",
        "Topic :: Internet",
    ],
    python_requires=">=3.9",
)
